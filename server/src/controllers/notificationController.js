const db = require('../config/db');
const { newId } = require('../middleware/auth');

async function getNotifications(req, res) {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT n.*, c.name as club_name 
       FROM notifications n 
       LEFT JOIN clubs c ON n.club_id = c.id 
       WHERE n.user_id = $1 
       ORDER BY n.created_at DESC 
       LIMIT 50`,
      [userId]
    );

    const unreadCount = result.rows.filter((r) => !r.read).length;

    res.json({
      success: true,
      unreadCount,
      data: result.rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        clubId: r.club_id,
        clubName: r.club_name,
        type: r.type,
        title: r.title,
        message: r.message,
        data: r.data || {},
        read: r.read,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function markRead(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    await db.query('UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2', [id, userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('markRead error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function markAllRead(req, res) {
  try {
    const userId = req.user.id;
    await db.query('UPDATE notifications SET read = TRUE WHERE user_id = $1', [userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('markAllRead error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

module.exports = {
  getNotifications,
  markRead,
  markAllRead,
};
