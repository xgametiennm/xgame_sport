const db = require('../config/db');

// In-memory active courts registry for ultra-fast real-time access (< 1ms)
// Map<courtId, CourtData>
const liveCourts = new Map();

// SSE Subscribers Set
// Set<{ res, courtId, clubId, connectedAt }>
const sseSubscribers = new Set();

// Send periodic heartbeat to keep SSE connections alive across proxies (e.g. Nginx, Cloudflare)
setInterval(() => {
  const ping = ': ping\n\n';
  for (const client of sseSubscribers) {
    try {
      client.res.write(ping);
    } catch {
      sseSubscribers.delete(client);
    }
  }
}, 15000);

// Auto-expire idle/abandoned matches to prevent courts from staying stuck
// 1. Matches with 0-0 and no updates for > 10 minutes are considered abandoned drafts -> auto-cleared.
// 2. Matches with active scores but no updates for > 30 minutes -> auto-cleared.
setInterval(async () => {
  try {
    const now = Date.now();
    const expiredCourtIds = [];
    const affectedClubs = new Set();

    for (const [courtId, court] of liveCourts.entries()) {
      const updatedTime = new Date(court.updatedAt || Date.now()).getTime();
      const idleMinutes = (now - updatedTime) / (1000 * 60);

      const isZeroZero = (court.score1 === 0 && court.score2 === 0);
      const isExpired = isZeroZero ? (idleMinutes > 10) : (idleMinutes > 30);

      if (isExpired) {
        expiredCourtIds.push(courtId);
        if (court.clubId) affectedClubs.add(court.clubId);
        broadcastUpdate(courtId, { ...court, isGameOver: true, isActive: false, lastAction: 'auto_expired' });
        liveCourts.delete(courtId);
      }
    }

    if (expiredCourtIds.length > 0) {
      await db.query(
        `UPDATE live_courts SET is_active = FALSE, updated_at = NOW() WHERE id = ANY($1::text[])`,
        [expiredCourtIds]
      ).catch(() => {});

      for (const clubId of affectedClubs) {
        broadcastCourtsList(clubId);
      }
    }
  } catch (err) {
    console.error('Error in auto-expire live courts cleaner:', err);
  }
}, 30000);

// Load persisted active courts from DB on startup
async function initLiveCourts() {
  try {
    const result = await db.query(
      `SELECT id, club_id, court_name, data, is_active, updated_at 
       FROM live_courts 
       WHERE is_active = TRUE AND updated_at > NOW() - INTERVAL '1 hour'`
    );
    for (const row of result.rows) {
      liveCourts.set(row.id, {
        id: row.id,
        clubId: row.club_id,
        courtName: row.court_name,
        ...row.data,
        updatedAt: row.updated_at,
      });
    }
  } catch (err) {
    // If table isn't created yet, schema upgrade will run
  }
}
setTimeout(initLiveCourts, 2000);

// Broadcast update to all SSE subscribers listening to this court or club
function broadcastUpdate(courtId, payload) {
  const eventPayload = `event: court_update\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseSubscribers) {
    // Client matches if subscribed to this specific court, or to all courts of this club, or all
    const matchesCourt = !client.courtId || client.courtId === courtId;
    const matchesClub = !client.clubId || client.clubId === payload.clubId;
    if (matchesCourt && matchesClub) {
      try {
        client.res.write(eventPayload);
      } catch {
        sseSubscribers.delete(client);
      }
    }
  }
}

function broadcastCourtsList(clubId) {
  for (const client of sseSubscribers) {
    if (!clubId || !client.clubId || client.clubId === clubId) {
      try {
        const courts = Array.from(liveCourts.values()).filter(c => !client.clubId || c.clubId === client.clubId);
        client.res.write(`event: courts_list\ndata: ${JSON.stringify(courts)}\n\n`);
      } catch {}
    }
  }
}

// GET /api/live/courts?clubId=...
async function getLiveCourts(req, res) {
  try {
    const { clubId } = req.query;
    const courts = [];
    for (const court of liveCourts.values()) {
      if ((!clubId || court.clubId === clubId) && court.isActive !== false) {
        courts.push(court);
      }
    }
    // Sort by recent activity
    courts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json({ success: true, data: courts });
  } catch (err) {
    console.error('getLiveCourts error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

// GET /api/live/court/:courtId
async function getCourt(req, res) {
  try {
    const { courtId } = req.params;
    let court = liveCourts.get(courtId);
    if (!court) {
      // Try DB fallback
      const result = await db.query('SELECT * FROM live_courts WHERE id = $1 AND is_active = TRUE', [courtId]);
      if (result.rows.length > 0) {
        const row = result.rows[0];
        court = {
          id: row.id,
          clubId: row.club_id,
          courtName: row.court_name,
          ...row.data,
          updatedAt: row.updated_at,
        };
        liveCourts.set(courtId, court);
      }
    }
    if (!court || court.isActive === false) {
      return res.status(404).json({ success: false, error: 'Court not found or not currently active' });
    }
    res.json({ success: true, data: court });
  } catch (err) {
    console.error('getCourt error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

// POST /api/live/court/:courtId
async function updateCourt(req, res) {
  try {
    const { courtId } = req.params;
    const body = req.body;
    if (!courtId) {
      return res.status(400).json({ success: false, error: 'courtId is required' });
    }

    const courtName = body.courtName || 'Sân Số 1';
    const clubId = body.clubId || null;
    const now = new Date().toISOString();

    const courtData = {
      id: courtId,
      courtName,
      clubId,
      clubName: body.clubName || '',
      scoringType: body.scoringType || 'sideout',
      targetScore: body.targetScore || 11,
      score1: body.score1 ?? 0,
      score2: body.score2 ?? 0,
      serverNumber: body.serverNumber || 2,
      servingTeam: body.servingTeam || 1,
      t1Right: body.t1Right || null,
      t1Left: body.t1Left || null,
      t2Right: body.t2Right || null,
      t2Left: body.t2Left || null,
      activeServerId: body.activeServerId || '',
      isGameOver: !!body.isGameOver,
      isActive: true,
      winnerTeam: body.winnerTeam || null,
      lastAction: body.lastAction || 'update',
      scorerName: body.scorerName || (req.user ? req.user.name : 'Trọng tài'),
      spectatorsCount: Array.from(sseSubscribers).filter(c => c.courtId === courtId).length,
      updatedAt: now,
    };

    // Update in-memory
    liveCourts.set(courtId, courtData);

    // Broadcast immediately to all SSE clients (< 2ms)
    broadcastUpdate(courtId, courtData);
    broadcastCourtsList(clubId);

    // Asynchronously upsert to DB
    if (clubId) {
      db.query(
        `INSERT INTO live_courts (id, club_id, court_name, data, is_active, updated_at)
         VALUES ($1, $2, $3, $4, TRUE, NOW())
         ON CONFLICT (id) DO UPDATE SET
           court_name = EXCLUDED.court_name,
           data = EXCLUDED.data,
           is_active = TRUE,
           updated_at = NOW()`,
        [courtId, clubId, courtName, JSON.stringify(courtData)]
      ).catch(err => console.error('Error persisting live_courts:', err));
    }

    res.json({ success: true, data: courtData });
  } catch (err) {
    console.error('updateCourt error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

// POST /api/live/court/:courtId/finish
async function finishCourt(req, res) {
  try {
    const { courtId } = req.params;
    const court = liveCourts.get(courtId);
    let clubId = null;
    if (court) {
      clubId = court.clubId;
      court.isGameOver = true;
      court.isActive = false;
      court.updatedAt = new Date().toISOString();
      broadcastUpdate(courtId, { ...court, isGameOver: true, isActive: false, lastAction: 'match_finished' });
      liveCourts.delete(courtId);
    }

    await db.query(
      `UPDATE live_courts SET is_active = FALSE, updated_at = NOW() WHERE id = $1`,
      [courtId]
    ).catch(() => {});

    broadcastCourtsList(clubId);

    res.json({ success: true });
  } catch (err) {
    console.error('finishCourt error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

// GET /api/live/stream?courtId=...&clubId=...
// Real-time Server-Sent Events (SSE) Stream
function streamCourt(req, res) {
  const { courtId, clubId } = req.query;

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Instruct Nginx not to buffer
    'Access-Control-Allow-Origin': '*',
  });

  res.write(': connected\n\n');

  // If specific court requested, send its current state immediately
  if (courtId && liveCourts.has(courtId)) {
    const current = liveCourts.get(courtId);
    res.write(`event: court_update\ndata: ${JSON.stringify(current)}\n\n`);
  } else if (!courtId) {
    // Send all active courts summary
    const courts = Array.from(liveCourts.values()).filter(c => !clubId || c.clubId === clubId);
    res.write(`event: courts_list\ndata: ${JSON.stringify(courts)}\n\n`);
  }

  const client = {
    res,
    courtId: courtId || null,
    clubId: clubId || null,
    connectedAt: Date.now(),
  };

  sseSubscribers.add(client);

  // Notify active spectators count if watching a court
  if (courtId && liveCourts.has(courtId)) {
    const court = liveCourts.get(courtId);
    court.spectatorsCount = Array.from(sseSubscribers).filter(c => c.courtId === courtId).length;
    broadcastUpdate(courtId, court);
  }

  req.on('close', () => {
    sseSubscribers.delete(client);
    if (courtId && liveCourts.has(courtId)) {
      const court = liveCourts.get(courtId);
      court.spectatorsCount = Array.from(sseSubscribers).filter(c => c.courtId === courtId).length;
      broadcastUpdate(courtId, court);
    }
  });
}

module.exports = {
  getLiveCourts,
  getCourt,
  updateCourt,
  finishCourt,
  streamCourt,
};
