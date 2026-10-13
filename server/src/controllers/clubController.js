const crypto = require('crypto');
const db = require('../config/db');
const { newId } = require('../middleware/auth');
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

// The club's in-progress play session (schedule and scores entered so far)
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
  try {
    const session = req.body;
    if (!session || !Array.isArray(session.matches) || !Array.isArray(session.memberIds)) {
      return res.status(400).json({ success: false, error: 'Dữ liệu buổi đấu không hợp lệ' });
    }
    await db.query(`
      INSERT INTO play_sessions (club_id, data, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (club_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `, [req.params.id, JSON.stringify(session)]);
    res.json({ success: true });
  } catch (err) {
    console.error('saveSession error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function deleteSession(req, res) {
  try {
    await db.query('DELETE FROM play_sessions WHERE club_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteSession error:', err);
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
  deleteSession,
};
