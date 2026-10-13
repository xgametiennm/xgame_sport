const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'xgame_pickleball_jwt_secret_2026';
const AUTH_COOKIE = 'xgame_token';
const SESSION_DAYS = 30;
const MANAGER_ROLES = ['owner', 'admin'];

const newId = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

// The session lives in an httpOnly cookie so the browser never exposes it to page scripts;
// a Bearer header is still accepted for non-browser clients.
function getToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  const cookies = (req.headers.cookie || '').split(';');
  for (const part of cookies) {
    const [name, ...rest] = part.trim().split('=');
    if (name === AUTH_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function cookieOptions(req) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    path: '/',
  };
}

function startSession(req, res, user) {
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
  res.cookie(AUTH_COOKIE, token, { ...cookieOptions(req), maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 });
}

function endSession(req, res) {
  res.clearCookie(AUTH_COOKIE, cookieOptions(req));
}

function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Vui lòng đăng nhập' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
  }
}

// An account belongs to a club through its own (not removed) player row there
async function getMembership(userId, clubId) {
  const result = await db.query(
    'SELECT * FROM players WHERE club_id = $1 AND user_id = $2 AND removed_at IS NULL',
    [clubId, userId]
  );
  return result.rows[0] || null;
}

const isManager = (membership) => !!membership && MANAGER_ROLES.includes(membership.role);

// Route guard: the signed-in user must be a member (or, with managersOnly, an owner/admin)
// of the club named by the request. Runs after requireAuth; sets req.membership.
function requireClubRole(getClubId, { managersOnly = false } = {}) {
  return async (req, res, next) => {
    try {
      const clubId = getClubId(req);
      if (!clubId) {
        return res.status(400).json({ success: false, error: 'Thiếu mã CLB' });
      }
      const membership = await getMembership(req.user.id, clubId);
      if (!membership) {
        return res.status(403).json({ success: false, error: 'Bạn không phải thành viên của CLB này' });
      }
      if (managersOnly && !isManager(membership)) {
        return res.status(403).json({ success: false, error: 'Chỉ chủ CLB hoặc quản trị viên mới thực hiện được thao tác này' });
      }
      req.membership = membership;
      next();
    } catch (err) {
      console.error('requireClubRole error:', err);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  };
}

module.exports = {
  requireAuth,
  requireClubRole,
  getMembership,
  isManager,
  getToken,
  startSession,
  endSession,
  newId,
  JWT_SECRET,
};
