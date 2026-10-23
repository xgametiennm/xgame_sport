const crypto = require('crypto');
const db = require('../config/db');
const { newId, isManager } = require('../middleware/auth');
const { happyAvatar } = require('../utils/avatar');

// No 0/O or 1/I, so the code is easy to read aloud and type
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const UNIQUE_VIOLATION = '23505';

function generateJoinCode() {
  const bytes = crypto.randomBytes(6);
  return 'XG' + [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function toClub(row, myRole) {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    description: row.description || '',
    courtsCount: row.courts_count,
    memberCount: parseInt(row.live_member_count || 0, 10),
    matchCount: parseInt(row.live_match_count || 0, 10),
    flagship: row.flagship,
    joinCode: row.join_code,
    myRole: myRole || row.my_role,
  };
}

const CLUB_WITH_COUNTS = `
  SELECT
    c.*,
    me.role AS my_role,
    (SELECT COUNT(*) FROM players WHERE club_id = c.id AND removed_at IS NULL) AS live_member_count,
    (SELECT COUNT(*) FROM matches WHERE club_id = c.id) AS live_match_count
  FROM clubs c
  JOIN players me ON me.club_id = c.id AND me.user_id = $1 AND me.removed_at IS NULL
`;

// Only the clubs the signed-in user belongs to
async function getClubs(req, res) {
  try {
    const result = await db.query(`${CLUB_WITH_COUNTS} ORDER BY c.created_at ASC`, [req.user.id]);
    res.json({ success: true, data: result.rows.map((row) => toClub(row)) });
  } catch (err) {
    console.error('getClubs error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function loadMyClub(runner, userId, clubId) {
  const result = await runner.query(`${CLUB_WITH_COUNTS} WHERE c.id = $2`, [userId, clubId]);
  return result.rows[0] ? toClub(result.rows[0]) : null;
}

async function loadUser(runner, userId) {
  const result = await runner.query('SELECT id, email, name, avatar FROM users WHERE id = $1', [userId]);
  return result.rows[0] || null;
}

const avatarFor = (user) => user.avatar || happyAvatar(user.email);

// Creates the club and enrols the signed-in user as its first member with the owner role
async function createClub(req, res) {
  const { name, location, description, courtsCount } = req.body;
  if (!name || !name.trim() || !location || !location.trim()) {
    return res.status(400).json({ success: false, error: 'Vui lòng nhập tên và địa điểm CLB' });
  }

  const client = await db.pool.connect();
  try {
    const user = await loadUser(client, req.user.id);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Tài khoản không tồn tại, vui lòng đăng nhập lại' });
    }

    const clubId = newId('club');
    const courts = Math.max(1, Math.min(50, parseInt(courtsCount, 10) || 4));

    // The join code is random; on the rare collision, try again with a new one
    for (let attempt = 0; ; attempt++) {
      try {
        await client.query('BEGIN');
        await client.query(`
          INSERT INTO clubs (id, name, location, description, courts_count, owner_user_id, join_code)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [clubId, name.trim(), location.trim(), (description || '').trim(), courts, user.id, generateJoinCode()]);
        break;
      } catch (err) {
        await client.query('ROLLBACK');
        if (err.code !== UNIQUE_VIOLATION || attempt >= 4) throw err;
      }
    }

    await client.query(`
      INSERT INTO players (id, club_id, user_id, name, email, avatar, role)
      VALUES ($1, $2, $3, $4, $5, $6, 'owner')
    `, [newId('p'), clubId, user.id, user.name, user.email, avatarFor(user)]);

    await client.query('COMMIT');

    res.status(201).json({ success: true, data: await loadMyClub(db, user.id, clubId) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('createClub error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  } finally {
    client.release();
  }
}

// Joins the club that owns the given code. The account takes over, in order: its own
// earlier membership (if it was removed), a guest record a manager created with the
// same email, or else a brand-new member record.
async function joinClub(req, res) {
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ success: false, error: 'Vui lòng nhập mã tham gia' });
  }

  const client = await db.pool.connect();
  try {
    const user = await loadUser(client, req.user.id);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Tài khoản không tồn tại, vui lòng đăng nhập lại' });
    }
    const clubRes = await client.query('SELECT id FROM clubs WHERE join_code = $1', [code]);
    const club = clubRes.rows[0];
    if (!club) {
      return res.status(404).json({ success: false, error: 'Mã tham gia không đúng' });
    }

    await client.query('BEGIN');
    const mine = await client.query(
      'SELECT id FROM players WHERE club_id = $1 AND user_id = $2 FOR UPDATE',
      [club.id, user.id]
    );
    if (mine.rows[0]) {
      await client.query('UPDATE players SET removed_at = NULL, updated_at = NOW() WHERE id = $1', [mine.rows[0].id]);
    } else {
      const guest = await client.query(`
        SELECT id FROM players
        WHERE club_id = $1 AND user_id IS NULL AND removed_at IS NULL AND LOWER(email) = LOWER($2)
        ORDER BY created_at ASC LIMIT 1 FOR UPDATE
      `, [club.id, user.email]);
      if (guest.rows[0]) {
        await client.query(
          'UPDATE players SET user_id = $1, name = $2, avatar = $3, updated_at = NOW() WHERE id = $4',
          [user.id, user.name, avatarFor(user), guest.rows[0].id]
        );
      } else {
        await client.query(`
          INSERT INTO players (id, club_id, user_id, name, email, avatar, role)
          VALUES ($1, $2, $3, $4, $5, $6, 'member')
        `, [newId('p'), club.id, user.id, user.name, user.email, avatarFor(user)]);
      }
    }
    await client.query('COMMIT');

    res.json({ success: true, data: await loadMyClub(db, user.id, club.id) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('joinClub error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  } finally {
    client.release();
  }
}

async function updateClub(req, res) {
  try {
    const { name, description } = req.body;
    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ success: false, error: 'Tên CLB không được để trống' });
    }

    await db.query(`
      UPDATE clubs
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          updated_at = NOW()
      WHERE id = $3
    `, [name !== undefined ? String(name).trim() : null, description !== undefined ? String(description) : null, req.params.id]);

    res.json({ success: true });
  } catch (err) {
    console.error('updateClub error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

// Owner only. Members, matches and the play session go with the club (ON DELETE CASCADE).
async function deleteClub(req, res) {
  try {
    if (req.membership.role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Chỉ chủ CLB mới xóa được CLB' });
    }
    await db.query('DELETE FROM clubs WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteClub error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

// The club's in-progress play session (schedule and scores entered so far).
//
// Several people follow one session from their own devices, so it is changed in two ways:
// - Scores go through updateSessionScore, one match at a time, so people entering
//   different matches at once never overwrite each other.
// - The schedule (lineups, added or removed matches) is replaced as a whole by saveSession,
//   only by the club's managers or whoever started the session. Each replacement must name
//   the version it was based on; a stale one is refused so an organiser cannot undo
//   another's changes without seeing them. Scores in a replacement are ignored for matches
//   the server already has: those only change through updateSessionScore.

const MAX_SCORE = 30;

const canManageSession = (req, session) =>
  isManager(req.membership) || (!!session && session.createdByUserId === req.user.id);

async function loadSessionForUpdate(client, clubId) {
  const result = await client.query('SELECT data FROM play_sessions WHERE club_id = $1 FOR UPDATE', [clubId]);
  return result.rows[0] ? result.rows[0].data : null;
}

async function storeSession(client, clubId, session) {
  await client.query(`
    INSERT INTO play_sessions (club_id, data, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (club_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `, [clubId, JSON.stringify(session)]);
}

// Every write bumps `revision`, so a client can tell an old response from a newer one
const nextRevision = (session) => ((session && session.revision) || 0) + 1;

// Runs fn(client) in a transaction; fn returns [status, body]
async function inTransaction(res, label, fn) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const [status, body] = await fn(client);
    await client.query(status < 400 ? 'COMMIT' : 'ROLLBACK');
    res.status(status).json(body);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`${label} error:`, err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  } finally {
    client.release();
  }
}

async function getSession(req, res) {
  try {
    const result = await db.query('SELECT data FROM play_sessions WHERE club_id = $1', [req.params.id]);
    res.json({ success: true, data: result.rows[0] ? result.rows[0].data : null });
  } catch (err) {
    console.error('getSession error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function saveSession(req, res) {
  const incoming = req.body;
  if (!incoming || !Array.isArray(incoming.matches) || !Array.isArray(incoming.memberIds)) {
    return res.status(400).json({ success: false, error: 'Dữ liệu buổi đấu không hợp lệ' });
  }

  await inTransaction(res, 'saveSession', async (client) => {
    const current = await loadSessionForUpdate(client, req.params.id);

    if (current) {
      // A stale copy first: this also covers starting a session while another one is running
      if ((incoming.version || 0) !== (current.version || 0)) {
        return [409, {
          success: false,
          conflict: true,
          error: 'Lịch thi đấu vừa được người khác thay đổi. Màn hình đã tải lại bản mới nhất, vui lòng thao tác lại.',
          data: current,
        }];
      }
      if (!canManageSession(req, current)) {
        return [403, { success: false, error: 'Chỉ chủ CLB, quản trị viên hoặc người tạo buổi đấu mới sửa được lịch thi đấu' }];
      }
    }

    const savedScores = new Map((current ? current.matches : []).map((m) => [m.id, m]));
    const session = {
      ...incoming,
      matches: incoming.matches.map((m) => {
        const saved = savedScores.get(m.id);
        return saved ? { ...m, score1: saved.score1, score2: saved.score2 } : m;
      }),
      // Who started the session is decided by the server, not by the client
      createdByUserId: current ? current.createdByUserId : req.user.id,
      version: (current ? current.version || 0 : 0) + 1,
      revision: nextRevision(current),
    };
    await storeSession(client, req.params.id, session);
    return [200, { success: true, data: session }];
  });
}

// Any member of the club may enter a score
async function updateSessionScore(req, res) {
  const parse = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 && n <= MAX_SCORE ? n : undefined;
  };
  const score1 = parse(req.body && req.body.score1);
  const score2 = parse(req.body && req.body.score2);
  if (score1 === undefined || score2 === undefined) {
    return res.status(400).json({ success: false, error: 'Tỉ số không hợp lệ' });
  }

  await inTransaction(res, 'updateSessionScore', async (client) => {
    const session = await loadSessionForUpdate(client, req.params.id);
    if (!session) {
      return [404, { success: false, error: 'Buổi đấu đã kết thúc' }];
    }
    const match = session.matches.find((m) => m.id === req.params.matchId);
    if (!match) {
      return [404, { success: false, error: 'Trận này đã bị xóa khỏi lịch thi đấu', data: session }];
    }
    match.score1 = score1;
    match.score2 = score2;
    session.revision = nextRevision(session);
    await storeSession(client, req.params.id, session);
    return [200, { success: true, data: session }];
  });
}

async function deleteSession(req, res) {
  await inTransaction(res, 'deleteSession', async (client) => {
    const current = await loadSessionForUpdate(client, req.params.id);
    if (current && !canManageSession(req, current)) {
      return [403, { success: false, error: 'Chỉ chủ CLB, quản trị viên hoặc người tạo buổi đấu mới kết thúc được buổi đấu' }];
    }
    await client.query('DELETE FROM play_sessions WHERE club_id = $1', [req.params.id]);
    return [200, { success: true }];
  });
}

// Club's tournament state (setup, draw, group stage & knockout bracket)
async function getTournament(req, res) {
  try {
    const result = await db.query('SELECT data FROM tournaments WHERE club_id = $1', [req.params.id]);
    res.json({ success: true, data: result.rows[0] ? result.rows[0].data : null });
  } catch (err) {
    console.error('getTournament error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function saveTournament(req, res) {
  try {
    const tournament = req.body;
    if (!tournament) {
      return res.status(400).json({ success: false, error: 'Dữ liệu giải đấu không hợp lệ' });
    }
    await db.query(`
      INSERT INTO tournaments (club_id, data, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (club_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `, [req.params.id, JSON.stringify(tournament)]);

    // A finished tournament is also kept in the club's history (later edits replace that copy),
    // so starting a new tournament does not lose its results
    if (tournament.currentPhase === 'finished' && tournament.id) {
      await db.query(`
        INSERT INTO tournament_history (id, club_id, data, finished_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
        WHERE tournament_history.club_id = EXCLUDED.club_id
      `, [String(tournament.id), req.params.id, JSON.stringify(tournament)]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('saveTournament error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function deleteTournament(req, res) {
  try {
    await db.query('DELETE FROM tournaments WHERE club_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteTournament error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

// Finished tournaments of the club, newest first
async function getTournamentHistory(req, res) {
  try {
    const result = await db.query(
      'SELECT data, finished_at FROM tournament_history WHERE club_id = $1 ORDER BY finished_at DESC LIMIT 100',
      [req.params.id]
    );
    res.json({
      success: true,
      data: result.rows.map((row) => ({ tournament: row.data, finishedAt: row.finished_at })),
    });
  } catch (err) {
    console.error('getTournamentHistory error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

// Managers only (checked by the route)
async function deleteTournamentHistory(req, res) {
  try {
    await db.query('DELETE FROM tournament_history WHERE id = $1 AND club_id = $2', [req.params.tournamentId, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteTournamentHistory error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

module.exports = {
  getClubs,
  createClub,
  joinClub,
  updateClub,
  deleteClub,
  getSession,
  saveSession,
  updateSessionScore,
  deleteSession,
  getTournament,
  saveTournament,
  deleteTournament,
  getTournamentHistory,
  deleteTournamentHistory,
};
