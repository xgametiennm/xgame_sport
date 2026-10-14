const express = require('express');
const router = express.Router();

const clubController = require('../controllers/clubController');
const playerController = require('../controllers/playerController');
const matchController = require('../controllers/matchController');
const authController = require('../controllers/authController');
const liveController = require('../controllers/liveController');
const { requireAuth, requireClubRole } = require('../middleware/auth');

// Every club route needs a signed-in user who belongs to that club;
// changing the club or its members additionally needs the owner/admin role.
const memberOf = (getClubId) => [requireAuth, requireClubRole(getClubId)];
const managerOf = (getClubId) => [requireAuth, requireClubRole(getClubId, { managersOnly: true })];
const clubInPath = (req) => req.params.id;

// Health Check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'XGame Sports Management API',
    version: '1.0.0'
  });
});

// Auth
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/google', authController.loginWithGoogle);
router.post('/auth/logout', authController.logout);
router.get('/auth/me', authController.getMe);
router.patch('/auth/me', requireAuth, authController.updateMe);
router.post('/auth/default-club', requireAuth, authController.setDefaultClub);

// Clubs (the list is the caller's own clubs)
router.get('/clubs', requireAuth, clubController.getClubs);
router.post('/clubs', requireAuth, clubController.createClub);
router.post('/clubs/join', requireAuth, clubController.joinClub);
router.patch('/clubs/:id', managerOf(clubInPath), clubController.updateClub);
router.delete('/clubs/:id', memberOf(clubInPath), clubController.deleteClub);

// In-progress play session of a club
router.get('/clubs/:id/session', memberOf(clubInPath), clubController.getSession);
router.put('/clubs/:id/session', memberOf(clubInPath), clubController.saveSession);
router.delete('/clubs/:id/session', memberOf(clubInPath), clubController.deleteSession);

// Members
router.get('/players', memberOf((req) => req.query.clubId), playerController.getPlayers);
router.post('/players', managerOf((req) => req.body.clubId), playerController.createPlayer);
router.patch('/players/:id', requireAuth, playerController.updatePlayerRole);
router.delete('/players/:id', requireAuth, playerController.removePlayer);

// Matches & DUPR calculation
router.get('/matches', memberOf((req) => req.query.clubId), matchController.getMatches);
router.post('/matches', memberOf((req) => req.body.clubId), matchController.createMatch);
router.patch('/matches/:id', requireAuth, matchController.updateMatch);
router.delete('/matches/:id', requireAuth, matchController.deleteMatch);

// Real-time Live Matches & Courtside Broadcast
router.get('/live/courts', liveController.getLiveCourts);
router.get('/live/court/:courtId', liveController.getCourt);
router.post('/live/court/:courtId', liveController.updateCourt);
router.post('/live/court/:courtId/finish', liveController.finishCourt);
router.get('/live/stream', liveController.streamCourt);

module.exports = router;
