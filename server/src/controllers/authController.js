const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { getToken, startSession, endSession, newId, JWT_SECRET } = require('../middleware/auth');
const { happyAvatar, isValidAvatar } = require('../utils/avatar');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const USER_COLUMNS = 'id, email, name, avatar, created_at';
const MIN_PASSWORD_LENGTH = 6;

function toUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar: row.avatar,
    createdAt: row.created_at,
  };
}

async function register(req, res) {
  try {
    const { email, name, password } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Email không hợp lệ' });
    }
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập họ và tên' });
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ success: false, error: `Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự` });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await db.query('SELECT 1 FROM users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Email này đã được đăng ký tài khoản' });
    }

    const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(10));
    const avatar = happyAvatar(cleanEmail);

    const insertRes = await db.query(`
      INSERT INTO users (id, email, password_hash, name, avatar)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING ${USER_COLUMNS}
    `, [newId('user'), cleanEmail, passwordHash, name.trim(), avatar]);

    const user = insertRes.rows[0];
    startSession(req, res, user);

    res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công',
      user: toUser(user),
    });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập email và mật khẩu' });
    }

    const userRes = await db.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    const user = userRes.rows[0];
    if (!user) {
      return res.status(401).json({ success: false, error: 'Tài khoản chưa tồn tại. Hãy đăng ký trước.' });
    }
    if (!user.password_hash) {
      return res.status(401).json({ success: false, error: 'Tài khoản này đăng nhập bằng Google' });
    }
    if (!(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ success: false, error: 'Mật khẩu không chính xác' });
    }

    startSession(req, res, user);

    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      user: toUser(user),
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function getMe(req, res) {
  try {
    const token = getToken(req);
    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);

    const userRes = await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [decoded.id]);
    if (userRes.rows.length === 0) {
      // The account behind this session no longer exists
      endSession(req, res);
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    res.json({ success: true, user: toUser(userRes.rows[0]) });
  } catch (err) {
    res.status(401).json({ success: false, error: 'Token invalid or expired' });
  }
}

function logout(req, res) {
  endSession(req, res);
  res.json({ success: true });
}

// Updates the account's display name and avatar everywhere it is a member and,
// when `clubId` is given, the caller's own ratings in that club
async function updateMe(req, res) {
  const { name, avatar, doublesRating, singlesRating, clubId } = req.body;
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'Vui lòng nhập họ và tên' });
  }
  if (avatar !== undefined && !isValidAvatar(avatar)) {
    return res.status(400).json({ success: false, error: 'Ảnh đại diện không hợp lệ hoặc quá lớn' });
  }
  const clampRating = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? Math.max(2, Math.min(8, parsed)) : null;
  };

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      `UPDATE users SET name = $1, avatar = COALESCE($2, avatar), updated_at = NOW() WHERE id = $3 RETURNING ${USER_COLUMNS}`,
      [name.trim(), avatar || null, req.user.id]
    );
    const user = userRes.rows[0];
    if (!user) {
      await client.query('ROLLBACK');
      return res.status(401).json({ success: false, error: 'Tài khoản không tồn tại, vui lòng đăng nhập lại' });
    }

    await client.query(
      'UPDATE players SET name = $1, avatar = $2, updated_at = NOW() WHERE user_id = $3',
      [name.trim(), user.avatar, user.id]
    );

    if (clubId) {
      await client.query(`
        UPDATE players
        SET doubles_rating = COALESCE($1, doubles_rating),
            singles_rating = COALESCE($2, singles_rating),
            updated_at = NOW()
        WHERE user_id = $3 AND club_id = $4 AND removed_at IS NULL
      `, [clampRating(doublesRating), clampRating(singlesRating), user.id, clubId]);
    }

    await client.query('COMMIT');
    res.json({ success: true, user: toUser(user) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('updateMe error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  } finally {
    client.release();
  }
}

async function loginWithGoogle(req, res) {
  try {
    let { email, name, avatar, googleId, credential } = req.body;

    // Handle Google ID Token (from Google Identity Services)
    if (credential) {
      try {
        let payload = null;
        if (GOOGLE_CLIENT_ID) {
          const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID,
          });
          payload = ticket.getPayload();
        } else {
          payload = jwt.decode(credential);
        }

        if (payload) {
          email = payload.email || email;
          name = payload.name || payload.given_name || name;
          avatar = payload.picture || avatar;
          googleId = payload.sub || googleId;
        }
      } catch (tokenErr) {
        console.warn('Google token verification fallback to decode:', tokenErr.message);
        const decoded = jwt.decode(credential);
        if (decoded && decoded.email) {
          email = decoded.email;
          name = decoded.name || decoded.given_name || email.split('@')[0];
          avatar = decoded.picture || avatar;
          googleId = decoded.sub || googleId;
        }
      }
    }

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Email Google không hợp lệ' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (name && name.trim()) || cleanEmail.split('@')[0];
    const userAvatar = avatar || happyAvatar(cleanEmail);

    // Check if user already exists
    const existing = await db.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);

    let user;
    if (existing.rows.length > 0) {
      user = existing.rows[0];
      // Fill in google_id or avatar only if missing: a chosen avatar is kept
      await db.query(`
        UPDATE users
        SET google_id = COALESCE($1, google_id),
            avatar = COALESCE(avatar, $2),
            updated_at = NOW()
        WHERE id = $3
      `, [googleId || null, userAvatar, user.id]);
    } else {
      const insertRes = await db.query(`
        INSERT INTO users (id, email, google_id, name, avatar)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING ${USER_COLUMNS}
      `, [newId('user'), cleanEmail, googleId || null, cleanName, userAvatar]);
      user = insertRes.rows[0];
    }

    startSession(req, res, user);

    res.json({
      success: true,
      message: 'Đăng nhập bằng tài khoản Google thành công',
      user: toUser(user),
    });
  } catch (err) {
    console.error('loginWithGoogle error:', err);
    res.status(500).json({ success: false, error: 'Lỗi xử lý xác thực Google' });
  }
}

module.exports = {
  register,
  login,
  loginWithGoogle,
  getMe,
  logout,
  updateMe,
};
