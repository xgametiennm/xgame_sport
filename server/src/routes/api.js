const express = require('express');
const router = express.Router();

const clubController = require('../controllers/clubController');
const playerController = require('../controllers/playerController');
const matchController = require('../controllers/matchController');
const authController = require('../controllers/authController');
const liveController = require('../controllers/liveController');
const notificationController = require('../controllers/notificationController');
const fundController = require('../controllers/fundController');
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
router.patch('/clubs/:id/session/matches/:matchId', memberOf(clubInPath), clubController.updateSessionScore);
router.delete('/clubs/:id/session', memberOf(clubInPath), clubController.deleteSession);

// Tournament of a club (Group stage, Knockout bracket, Pairing, Random spin)
router.get('/clubs/:id/tournament', memberOf(clubInPath), clubController.getTournament);
router.put('/clubs/:id/tournament', memberOf(clubInPath), clubController.saveTournament);
router.delete('/clubs/:id/tournament', memberOf(clubInPath), clubController.deleteTournament);
router.get('/clubs/:id/tournament-history', memberOf(clubInPath), clubController.getTournamentHistory);

// Club fund: members see it, managers keep it
const FUND = '/clubs/:id/fund';
router.get(FUND, memberOf(clubInPath), fundController.getFund);
router.get(`${FUND}/logs`, memberOf(clubInPath), fundController.getLogs);
router.put(`${FUND}/settings`, managerOf(clubInPath), fundController.saveSettings);
// The treasurer's payment QR picture: managers upload it, every member can see it
router.put(`${FUND}/settings/qr`, managerOf(clubInPath), fundController.uploadQrImage);
router.delete(`${FUND}/settings/qr`, managerOf(clubInPath), fundController.deleteQrImage);
router.get(`${FUND}/settings/qr`, memberOf(clubInPath), fundController.getQrImage);
// Members report their own transfers; managers confirm or reject them
router.post(`${FUND}/campaigns/:campaignId/claims`, memberOf(clubInPath), fundController.createClaim);
router.delete(`${FUND}/claims/:claimId`, memberOf(clubInPath), fundController.cancelClaim);
router.post(`${FUND}/claims/:claimId/approve`, managerOf(clubInPath), fundController.approveClaim);
router.post(`${FUND}/claims/:claimId/reject`, managerOf(clubInPath), fundController.rejectClaim);
router.get(`${FUND}/claims/:claimId/proof`, memberOf(clubInPath), fundController.getClaimProof);
router.post(`${FUND}/campaigns`, managerOf(clubInPath), fundController.createCampaign);
router.patch(`${FUND}/campaigns/:campaignId`, managerOf(clubInPath), fundController.updateCampaign);
router.delete(`${FUND}/campaigns/:campaignId`, managerOf(clubInPath), fundController.deleteCampaign);
router.put(`${FUND}/campaigns/:campaignId/contributions/:playerId`, managerOf(clubInPath), fundController.setContribution);
router.delete(`${FUND}/campaigns/:campaignId/contributions/:playerId`, managerOf(clubInPath), fundController.deleteContribution);
router.post(`${FUND}/expenses`, managerOf(clubInPath), fundController.createExpense);
router.patch(`${FUND}/expenses/:expenseId`, managerOf(clubInPath), fundController.updateExpense);
router.delete(`${FUND}/expenses/:expenseId`, managerOf(clubInPath), fundController.deleteExpense);
router.post(`${FUND}/expenses/:expenseId/receipts`, managerOf(clubInPath), fundController.addReceipt);
// No file extension in the path: nginx caches *.jpg, *.png... as public static assets
router.get(`${FUND}/receipts/:receiptId`, memberOf(clubInPath), fundController.getReceipt);
router.delete(`${FUND}/receipts/:receiptId`, managerOf(clubInPath), fundController.deleteReceipt);
router.delete('/clubs/:id/tournament-history/:tournamentId', managerOf(clubInPath), clubController.deleteTournamentHistory);


// Members
router.get('/players', memberOf((req) => req.query.clubId), playerController.getPlayers);
router.post('/players', managerOf((req) => req.body.clubId), playerController.createPlayer);
router.patch('/players/:id', requireAuth, playerController.updatePlayerRole);
router.delete('/players/:id', requireAuth, playerController.removePlayer);

// Matches & DUPR calculation
router.get('/matches', memberOf((req) => req.query.clubId), matchController.getMatches);
router.post('/matches', memberOf((req) => req.body.clubId), matchController.createMatch);
router.post('/matches/:id/confirm', requireAuth, matchController.confirmMatch);
router.post('/matches/:id/appeal', requireAuth, matchController.appealMatch);
router.patch('/matches/:id', requireAuth, matchController.updateMatch);
router.delete('/matches/:id', requireAuth, matchController.deleteMatch);

// Notifications
router.get('/notifications', requireAuth, notificationController.getNotifications);
router.patch('/notifications/:id/read', requireAuth, notificationController.markRead);
router.post('/notifications/read-all', requireAuth, notificationController.markAllRead);

// Real-time Live Matches & Courtside Broadcast
router.get('/live/courts', liveController.getLiveCourts);
router.get('/live/court/:courtId', liveController.getCourt);
router.post('/live/court/:courtId', liveController.updateCourt);
router.post('/live/court/:courtId/finish', liveController.finishCourt);
router.get('/live/stream', liveController.streamCourt);

module.exports = router;
