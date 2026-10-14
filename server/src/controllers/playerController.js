const db = require('../config/db');
const { getMembership, isManager, newId } = require('../middleware/auth');
const { happyAvatar } = require('../utils/avatar');

const CLUB_ROLES = ['owner', 'admin', 'member'];

function toPlayer(row) {
  return {
    id: row.id,
    clubId: row.club_id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    avatar: row.avatar,
    doublesRating: parseFloat(row.doubles_rating),
    singlesRating: parseFloat(row.singles_rating),
    provisionalDoubles: row.provisional_doubles,
    provisionalSingles: row.provisional_singles,
    matchesPlayedDoubles: row.matches_played_doubles,
    matchesPlayedSingles: row.matches_played_singles,
    winsDoubles: row.wins_doubles,
    lossesDoubles: row.losses_doubles,
    winsSingles: row.wins_singles,
    lossesSingles: row.losses_singles,
    pointDifferential: row.point_differential,
    streak: row.streak,
    form: row.form || [],
    rankDelta: row.rank_delta,
    role: row.role || 'member',
  };
}

// Members of one club (route guard has already checked the caller belongs to it)
async function getPlayers(req, res) {
  try {
    const result = await db.query(`
      SELECT * FROM players
      WHERE club_id = $1 AND removed_at IS NULL
      ORDER BY wins_doubles DESC, doubles_rating DESC, created_at ASC
    `, [req.query.clubId]);
    res.json({ success: true, data: result.rows.map(toPlayer) });
  } catch (err) {
    console.error('getPlayers error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

// A manager adds a guest member by name. If an email is given, the person with that
// account takes over this record when they later join the club with its code.
async function createPlayer(req, res) {
  try {
    const { clubId, name, email, doublesRating, singlesRating } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập tên thành viên' });
    }
    const cleanEmail = email && email.trim() ? email.trim().toLowerCase() : null;
    if (cleanEmail) {
      const dup = await db.query(
        'SELECT 1 FROM players WHERE club_id = $1 AND removed_at IS NULL AND LOWER(email) = $2',
        [clubId, cleanEmail]
      );
      if (dup.rows.length > 0) {
        return res.status(400).json({ success: false, error: 'Email này đã có trong CLB' });
      }
    }

    const clamp = (value, fallback) => {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? Math.max(2, Math.min(8, parsed)) : fallback;
    };
    const avatar = happyAvatar(cleanEmail || name.trim());

    const result = await db.query(`
      INSERT INTO players (id, club_id, name, email, avatar, doubles_rating, singles_rating)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [newId('p'), clubId, name.trim(), cleanEmail, avatar, clamp(doublesRating, 3.5), clamp(singlesRating, 3.2)]);

    res.status(201).json({ success: true, data: toPlayer(result.rows[0]) });
  } catch (err) {
    console.error('createPlayer error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

// Loads the member a management request targets and checks the caller manages their club
async function loadManagedPlayer(req, res) {
  const result = await db.query('SELECT * FROM players WHERE id = $1 AND removed_at IS NULL', [req.params.id]);
  const player = result.rows[0];
  if (!player) {
    res.status(404).json({ success: false, error: 'Không tìm thấy thành viên' });
    return null;
  }
  const membership = await getMembership(req.user.id, player.club_id);
  if (!isManager(membership)) {
    res.status(403).json({ success: false, error: 'Chỉ chủ CLB hoặc quản trị viên mới thực hiện được thao tác này' });
    return null;
  }
  return { player, membership };
}

const LAST_OWNER_ERROR = 'CLB phải có ít nhất một chủ CLB. Hãy thêm chủ CLB khác trước.';

// Locks the club's owner rows for the transaction, so two owners stepping down at the
// same time cannot leave the club without one
async function lockOwnerIds(client, clubId) {
  const result = await client.query(
    "SELECT id FROM players WHERE club_id = $1 AND role = 'owner' AND removed_at IS NULL FOR UPDATE",
    [clubId]
  );
  return result.rows.map((row) => row.id);
}

async function updatePlayerRole(req, res) {
  const { role } = req.body;
  if (!CLUB_ROLES.includes(role)) {
    return res.status(400).json({ success: false, error: 'Quyền không hợp lệ' });
  }

  const client = await db.pool.connect();
  try {
    const managed = await loadManagedPlayer(req, res);
    if (!managed) return;
    const { player, membership } = managed;

    await client.query('BEGIN');
    const ownerIds = await lockOwnerIds(client, player.club_id);
    const targetIsOwner = ownerIds.includes(player.id);
    const reject = async (status, error) => {
      await client.query('ROLLBACK');
      res.status(status).json({ success: false, error });
    };

    // A club can have several owners. Only an owner grants or revokes ownership,
    // and only a member with an account can hold it.
    if ((role === 'owner' || targetIsOwner) && !ownerIds.includes(membership.id)) {
      return reject(403, 'Chỉ chủ CLB mới thay đổi được quyền chủ CLB');
    }
    if (role === 'owner' && !player.user_id) {
      return reject(400, 'Chỉ cấp được quyền chủ CLB cho thành viên có tài khoản');
    }
    if (targetIsOwner && role !== 'owner' && ownerIds.length === 1) {
      return reject(400, LAST_OWNER_ERROR);
    }

    await client.query('UPDATE players SET role = $1, updated_at = NOW() WHERE id = $2', [role, player.id]);
    await client.query('COMMIT');

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('updatePlayerRole error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  } finally {
    client.release();
  }
}

// Members are hidden rather than deleted so their past matches stay intact
async function removePlayer(req, res) {
  const client = await db.pool.connect();
  try {
    const managed = await loadManagedPlayer(req, res);
    if (!managed) return;
    const { player, membership } = managed;

    await client.query('BEGIN');
    const ownerIds = await lockOwnerIds(client, player.club_id);
    if (ownerIds.includes(player.id)) {
      // An owner is removed only by an owner, and never the last one
      const error = !ownerIds.includes(membership.id)
        ? [403, 'Chỉ chủ CLB mới xóa được chủ CLB khác']
        : ownerIds.length === 1 ? [400, LAST_OWNER_ERROR] : null;
      if (error) {
        await client.query('ROLLBACK');
        return res.status(error[0]).json({ success: false, error: error[1] });
      }
    }

    // Any management role ends with the membership: rejoining starts again as a plain member
    await client.query("UPDATE players SET removed_at = NOW(), role = 'member', updated_at = NOW() WHERE id = $1", [player.id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('removePlayer error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  } finally {
    client.release();
  }
}

module.exports = {
  toPlayer,
  getPlayers,
  createPlayer,
  updatePlayerRole,
  removePlayer,
};
