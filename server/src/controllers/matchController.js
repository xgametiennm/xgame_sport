const db = require('../config/db');
const { toPlayer } = require('./playerController');
const { newId, getMembership, isManager } = require('../middleware/auth');
const { calculateDuprMatchDelta } = require('../services/duprEngine');

const MIN_RATING = 2.0;
const MAX_RATING = 8.0;
const PROVISIONAL_MATCHES = 10;

const num = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

// Shapes a stored match the way the client models it (MatchResult)
function toMatch(row, playersById) {
  const details = row.details || {};
  const legacyDelta = num(row.delta_rating);

  const team = (p1Id, p2Id, info, fallbackDelta) => ({
    player1: playersById.get(p1Id),
    player2: p2Id ? playersById.get(p2Id) : undefined,
    startRatingAvg: num(info && info.startRatingAvg),
    deltaRating: num(info && info.deltaRating, fallbackDelta),
    newRatingAvg: num(info && info.newRatingAvg),
  });

  return {
    id: row.id,
    clubId: row.club_id,
    date: row.match_date,
    format: row.format,
    importance: row.importance,
    courtName: row.court_name,
    winner: row.winner,
    sets: row.sets,
    totalScoreTeam1: row.total_score_team1,
    totalScoreTeam2: row.total_score_team2,
    team1: team(row.team1_player1_id, row.team1_player2_id, details.team1, row.winner === 1 ? legacyDelta : -legacyDelta),
    team2: team(row.team2_player1_id, row.team2_player2_id, details.team2, row.winner === 2 ? legacyDelta : -legacyDelta),
    expectedWinProbTeam1: num(details.expectedWinProbTeam1, 0.5),
    expectedWinProbTeam2: num(details.expectedWinProbTeam2, 0.5),
    actualPointsShareTeam1: num(details.actualPointsShareTeam1, 0.5),
    expectedPointsShareTeam1: num(details.expectedPointsShareTeam1, 0.5),
    marginOfVictoryFactor: num(details.marginOfVictoryFactor, 1),
    notes: row.notes || '',
    updatedByName: row.updated_by_name || (details.lastUpdatedBy && details.lastUpdatedBy.name) || null,
    updatedAt: row.updated_at || (details.lastUpdatedBy && details.lastUpdatedBy.at) || null,
    updatedByRole: (details.lastUpdatedBy && details.lastUpdatedBy.role) || null,
    confirmedPlayerIds: Array.isArray(details.confirmedPlayerIds) ? details.confirmedPlayerIds : [],
    appeals: Array.isArray(details.appeals) ? details.appeals : [],
    createdByUserId: row.created_by_user_id || (details.createdBy && details.createdBy.userId) || null,
    createdByPlayerId: (details.createdBy && details.createdBy.playerId) || null,
    createdByName: (details.createdBy && details.createdBy.name) || null,
  };
}

async function loadPlayersById(runner, rows) {
  const ids = new Set();
  rows.forEach((r) => {
    [r.team1_player1_id, r.team1_player2_id, r.team2_player1_id, r.team2_player2_id].forEach((id) => id && ids.add(id));
  });
  if (ids.size === 0) return new Map();
  // Removed members are included on purpose: their past matches must still resolve
  const result = await runner.query('SELECT * FROM players WHERE id = ANY($1)', [[...ids]]);
  return new Map(result.rows.map((row) => [row.id, toPlayer(row)]));
}

async function getMatches(req, res) {
  try {
    const { clubId, limit: queryLimit, page } = req.query;
    let queryText = 'SELECT * FROM matches';
    const params = [];
    if (clubId) {
      params.push(clubId);
      queryText += ' WHERE club_id = $1';
    }

    const limit = Math.max(1, Math.min(500, parseInt(queryLimit, 10) || 500));
    params.push(limit);
    queryText += ` ORDER BY match_date DESC LIMIT $${params.length}`;

    if (page && parseInt(page, 10) > 1) {
      const offset = (parseInt(page, 10) - 1) * limit;
      params.push(offset);
      queryText += ` OFFSET $${params.length}`;
    }

    const result = await db.query(queryText, params);
    const playersById = await loadPlayersById(db, result.rows);
    res.json({ success: true, data: result.rows.map((row) => toMatch(row, playersById)) });
  } catch (err) {
    console.error('getMatches error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

// Stores a finished match and applies its result to every participant's record.
// The body is the client's MatchResult (rating deltas are computed by the shared DUPR
// engine on the client) plus `clubId`.
async function recordMatch(req, res) {
  const body = req.body || {};
  const { clubId, format = 'doubles', importance = 'league', courtName = 'Sân CLB', sets, notes } = body;
  const winner = Number(body.winner);
  const score1 = Number(body.totalScoreTeam1);
  const score2 = Number(body.totalScoreTeam2);
  const team1 = body.team1 || {};
  const team2 = body.team2 || {};
  const idOf = (player) => (player && player.id) || null;
  const lineup = {
    team1: [idOf(team1.player1), idOf(team1.player2)].filter(Boolean),
    team2: [idOf(team2.player1), idOf(team2.player2)].filter(Boolean),
  };
  const perTeam = format === 'singles' ? 1 : 2;
  const allIds = [...lineup.team1, ...lineup.team2];

  if (
    !clubId || ![1, 2].includes(winner) || !Array.isArray(sets) || sets.length === 0 ||
    !Number.isFinite(score1) || !Number.isFinite(score2) ||
    lineup.team1.length !== perTeam || lineup.team2.length !== perTeam ||
    new Set(allIds).size !== allIds.length
  ) {
    return res.status(400).json({ success: false, error: 'Thông tin trận đấu không hợp lệ' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const playersRes = await client.query(
      'SELECT * FROM players WHERE id = ANY($1) AND club_id = $2 AND removed_at IS NULL FOR UPDATE',
      [allIds, clubId]
    );
    if (playersRes.rows.length !== allIds.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Có người chơi không thuộc CLB này' });
    }
    const rowsById = new Map(playersRes.rows.map((row) => [row.id, row]));

    const teamInfo = (team) => ({
      startRatingAvg: num(team.startRatingAvg),
      deltaRating: Math.max(-1, Math.min(1, num(team.deltaRating))),
      newRatingAvg: num(team.newRatingAvg),
    });
    const creatorPlayerId = (req.membership && allIds.includes(req.membership.id)) ? req.membership.id : null;
    const initialConfirmed = creatorPlayerId ? [creatorPlayerId] : [];
    const creatorUserId = req.user ? req.user.id : null;
    const creatorName = req.membership ? req.membership.name : (req.user ? req.user.name : 'Người ghi nhận');

    const details = {
      team1: teamInfo(team1),
      team2: teamInfo(team2),
      expectedWinProbTeam1: num(body.expectedWinProbTeam1, 0.5),
      expectedWinProbTeam2: num(body.expectedWinProbTeam2, 0.5),
      actualPointsShareTeam1: num(body.actualPointsShareTeam1, 0.5),
      expectedPointsShareTeam1: num(body.expectedPointsShareTeam1, 0.5),
      marginOfVictoryFactor: num(body.marginOfVictoryFactor, 1),
      confirmedPlayerIds: initialConfirmed,
      appeals: [],
      createdBy: {
        userId: creatorUserId,
        playerId: req.membership ? req.membership.id : null,
        name: creatorName,
      },
    };

    const matchDate = body.date && !Number.isNaN(Date.parse(body.date)) ? new Date(body.date) : new Date();
    const matchId = newId('match');

    const insertRes = await client.query(`
      INSERT INTO matches (
        id, club_id, match_date, format, importance, court_name, winner, sets,
        total_score_team1, total_score_team2,
        team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id,
        delta_rating, notes, details, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `, [
      matchId, clubId, matchDate, format, importance, courtName, winner, JSON.stringify(sets),
      score1, score2,
      lineup.team1[0], lineup.team1[1] || null, lineup.team2[0], lineup.team2[1] || null,
      Math.abs(details.team1.deltaRating), notes || '', JSON.stringify(details),
      creatorUserId,
    ]);

    const applyResult = async (playerId, delta, won, pointDiff) => {
      const p = rowsById.get(playerId);
      const prefix = format === 'singles' ? 'singles' : 'doubles';
      const played = p[`matches_played_${prefix}`] + 1;
      const rating = Math.max(MIN_RATING, Math.min(MAX_RATING, parseFloat(p[`${prefix}_rating`]) + delta));
      const streak = won ? (p.streak > 0 ? p.streak + 1 : 1) : (p.streak < 0 ? p.streak - 1 : -1);
      const form = [won ? 'W' : 'L', ...(p.form || []).slice(0, 4)];

      await client.query(`
        UPDATE players
        SET ${prefix}_rating = $1,
            matches_played_${prefix} = $2,
            wins_${prefix} = wins_${prefix} + $3,
            losses_${prefix} = losses_${prefix} + $4,
            provisional_${prefix} = $5,
            streak = $6,
            point_differential = point_differential + $7,
            form = $8,
            updated_at = NOW()
        WHERE id = $9
      `, [rating.toFixed(3), played, won ? 1 : 0, won ? 0 : 1, played < PROVISIONAL_MATCHES, streak, pointDiff, form, playerId]);
    };

    for (const id of lineup.team1) await applyResult(id, details.team1.deltaRating, winner === 1, score1 - score2);
    for (const id of lineup.team2) await applyResult(id, details.team2.deltaRating, winner === 2, score2 - score1);

    await client.query('UPDATE clubs SET match_count = match_count + 1 WHERE id = $1', [clubId]);

    // Send notifications to all participants who have accounts
    const team1Names = lineup.team1.map((id) => rowsById.get(id)?.name || 'VĐV').join(' & ');
    const team2Names = lineup.team2.map((id) => rowsById.get(id)?.name || 'VĐV').join(' & ');

    for (const id of allIds) {
      const p = rowsById.get(id);
      if (p && p.user_id) {
        const isCreator = (id === creatorPlayerId);
        const notifId = newId('notif');
        const title = isCreator ? 'Bạn đã ghi nhận kết quả trận đấu' : 'Kết quả trận đấu mới cần xác nhận';
        const message = `Trận đấu: ${team1Names} (${score1}) vs ${team2Names} (${score2}) tại ${courtName}. ` +
          (isCreator ? 'Kết quả đã được ghi nhận và bạn đã tự động xác nhận.' : 'Vui lòng xác nhận kết quả hoặc gửi kháng cáo nếu có sai sót.');

        await client.query(`
          INSERT INTO notifications (id, user_id, club_id, type, title, message, data, read)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          notifId,
          p.user_id,
          clubId,
          'match_result',
          title,
          message,
          JSON.stringify({
            matchId,
            clubId,
            score1,
            score2,
            team1Names,
            team2Names,
            courtName,
            format,
            date: matchDate.toISOString(),
          }),
          isCreator,
        ]);
      }
    }

    const playersById = await loadPlayersById(client, insertRes.rows);
    await client.query('COMMIT');

    res.status(201).json({ success: true, data: toMatch(insertRes.rows[0], playersById) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('recordMatch error:', err);
    res.status(500).json({ success: false, error: 'Database transaction error' });
  } finally {
    client.release();
  }
}

async function recalculatePlayerStreakAndForm(client, clubId, playerId, excludeMatchId = null) {
  let query = `
    SELECT id, winner, team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id
    FROM matches
    WHERE club_id = $1 AND ($2 IN (team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id))
  `;
  const params = [clubId, playerId];
  if (excludeMatchId) {
    params.push(excludeMatchId);
    query += ` AND id <> $${params.length}`;
  }
  query += ` ORDER BY match_date DESC, created_at DESC LIMIT 20`;

  const res = await client.query(query, params);
  let streak = 0;
  const form = [];

  for (let i = 0; i < res.rows.length; i++) {
    const row = res.rows[i];
    const isTeam1 = (row.team1_player1_id === playerId || row.team1_player2_id === playerId);
    const won = (isTeam1 && row.winner === 1) || (!isTeam1 && row.winner === 2);
    if (i < 5) form.push(won ? 'W' : 'L');

    if (i === 0) {
      streak = won ? 1 : -1;
    } else {
      if (won && streak > 0) streak++;
      else if (!won && streak < 0) streak--;
    }
  }

  await client.query(
    'UPDATE players SET streak = $1, form = $2, updated_at = NOW() WHERE id = $3',
    [streak, form, playerId]
  );
}

async function rollbackMatchStats(client, match) {
  const format = match.format || 'doubles';
  const prefix = format === 'singles' ? 'singles' : 'doubles';
  const winner = Number(match.winner);
  const score1 = Number(match.total_score_team1);
  const score2 = Number(match.total_score_team2);

  let deltaTeam1 = 0;
  let deltaTeam2 = 0;
  const details = typeof match.details === 'string' ? JSON.parse(match.details || '{}') : (match.details || {});
  if (details.team1 && typeof details.team1.deltaRating === 'number') {
    deltaTeam1 = details.team1.deltaRating;
    deltaTeam2 = details.team2 ? details.team2.deltaRating : -deltaTeam1;
  } else {
    const absDelta = parseFloat(match.delta_rating) || 0;
    deltaTeam1 = winner === 1 ? absDelta : -absDelta;
    deltaTeam2 = winner === 2 ? absDelta : -absDelta;
  }

  const team1Ids = [match.team1_player1_id, match.team1_player2_id].filter(Boolean);
  const team2Ids = [match.team2_player1_id, match.team2_player2_id].filter(Boolean);
  const allIds = [...team1Ids, ...team2Ids];

  const playersRes = await client.query(
    'SELECT * FROM players WHERE id = ANY($1) FOR UPDATE',
    [allIds]
  );
  const rowsById = new Map(playersRes.rows.map((r) => [r.id, r]));

  const revertPlayer = async (playerId, deltaAdded, won, pointDiff) => {
    const p = rowsById.get(playerId);
    if (!p) return;
    const played = Math.max(0, (p[`matches_played_${prefix}`] || 1) - 1);
    const currentRating = parseFloat(p[`${prefix}_rating`]) || 3.5;
    const newRating = Math.max(MIN_RATING, Math.min(MAX_RATING, currentRating - deltaAdded));
    const winDec = won ? 1 : 0;
    const lossDec = won ? 0 : 1;

    await client.query(`
      UPDATE players
      SET ${prefix}_rating = $1,
          matches_played_${prefix} = $2,
          wins_${prefix} = GREATEST(0, wins_${prefix} - $3),
          losses_${prefix} = GREATEST(0, losses_${prefix} - $4),
          provisional_${prefix} = $5,
          point_differential = point_differential - $6,
          updated_at = NOW()
      WHERE id = $7
    `, [newRating.toFixed(3), played, winDec, lossDec, played < PROVISIONAL_MATCHES, pointDiff, playerId]);
  };

  for (const id of team1Ids) await revertPlayer(id, deltaTeam1, winner === 1, score1 - score2);
  for (const id of team2Ids) await revertPlayer(id, deltaTeam2, winner === 2, score2 - score1);

  await client.query('UPDATE clubs SET match_count = GREATEST(0, match_count - 1) WHERE id = $1', [match.club_id]);
}

async function checkMatchEditPermission(req, res, matchId, action = 'sửa') {
  const matchRes = await db.query('SELECT * FROM matches WHERE id = $1', [matchId]);
  if (matchRes.rows.length === 0) {
    res.status(404).json({ success: false, error: 'Không tìm thấy trận đấu' });
    return null;
  }
  const match = matchRes.rows[0];
  const membership = await getMembership(req.user.id, match.club_id);
  if (!membership) {
    res.status(403).json({ success: false, error: 'Bạn không phải là thành viên của CLB này' });
    return null;
  }

  // 1. Quản trị viên và Chủ CLB luôn có quyền sửa và xóa
  if (isManager(membership)) {
    return { match, membership, isManager: true };
  }

  // 2. Kiểm tra nếu là người tạo điểm số (người ghi nhận trận đấu)
  const details = typeof match.details === 'string' ? JSON.parse(match.details || '{}') : (match.details || {});
  const createdByUserId = match.created_by_user_id || (details.createdBy && details.createdBy.userId);
  const createdByPlayerId = details.createdBy && details.createdBy.playerId;

  const isCreator = Boolean(
    (createdByUserId && createdByUserId === req.user.id) ||
    (createdByPlayerId && createdByPlayerId === membership.id)
  );

  if (!isCreator) {
    res.status(403).json({
      success: false,
      error: 'Chỉ người tạo điểm số hoặc Quản trị viên CLB mới có quyền chỉnh sửa kết quả trận đấu'
    });
    return null;
  }

  // 3. Khi chưa xác nhận thì người tạo điểm số vẫn edit được.
  // Khi có người confirm rồi thì người nhập không edit được nữa mà chỉ admin có quyền sửa.
  const confirmedPlayerIds = Array.isArray(details.confirmedPlayerIds) ? details.confirmedPlayerIds : [];
  // Người xác nhận khác (không tính bản thân người tạo nếu họ đã tự xác nhận):
  const otherConfirmations = confirmedPlayerIds.filter((id) => id !== createdByPlayerId);

  if (otherConfirmations.length > 0) {
    res.status(403).json({
      success: false,
      error: 'Kết quả trận đấu đã được người chơi khác xác nhận. Khi đã có người xác nhận, chỉ Quản trị viên hoặc Chủ CLB mới có quyền chỉnh sửa.'
    });
    return null;
  }

  return { match, membership, isManager: false };
}

async function deleteMatch(req, res) {
  try {
    const check = await checkMatchEditPermission(req, res, req.params.id, 'xóa');
    if (!check) return;
    const { match } = check;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await rollbackMatchStats(client, match);
      await client.query('DELETE FROM matches WHERE id = $1', [match.id]);

      const allIds = [match.team1_player1_id, match.team1_player2_id, match.team2_player1_id, match.team2_player2_id].filter(Boolean);
      for (const id of allIds) {
        await recalculatePlayerStreakAndForm(client, match.club_id, id);
      }

      await client.query('COMMIT');
      res.json({ success: true, message: 'Đã xóa kết quả trận đấu thành công' });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('deleteMatch error:', err);
      res.status(500).json({ success: false, error: 'Lỗi khi xóa trận đấu' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('deleteMatch outer error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

async function updateMatch(req, res) {
  try {
    const check = await checkMatchEditPermission(req, res, req.params.id, 'sửa');
    if (!check) return;
    const { match: oldMatch, membership } = check;
    const body = req.body || {};

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Rollback old match's player statistics
      await rollbackMatchStats(client, oldMatch);

      // 2. Prepare new match data
      const clubId = oldMatch.club_id;
      const format = body.format || oldMatch.format || 'doubles';
      const importance = body.importance || oldMatch.importance || 'league';
      const courtName = body.courtName || oldMatch.court_name || 'Sân CLB';
      const winner = Number(body.winner !== undefined ? body.winner : oldMatch.winner);
      const score1 = Number(body.totalScoreTeam1 !== undefined ? body.totalScoreTeam1 : oldMatch.total_score_team1);
      const score2 = Number(body.totalScoreTeam2 !== undefined ? body.totalScoreTeam2 : oldMatch.total_score_team2);
      const sets = body.sets || oldMatch.sets || [{ team1: score1, team2: score2 }];
      const notes = body.notes !== undefined ? body.notes : oldMatch.notes;
      const matchDate = body.date && !Number.isNaN(Date.parse(body.date)) ? new Date(body.date) : oldMatch.match_date;

      const team1 = body.team1 || {};
      const team2 = body.team2 || {};
      const idOf = (p) => (p && (typeof p === 'object' ? p.id : p)) || null;

      const lineup = {
        team1: [
          idOf(team1.player1) || oldMatch.team1_player1_id,
          idOf(team1.player2) || (format === 'doubles' ? oldMatch.team1_player2_id : null),
        ].filter(Boolean),
        team2: [
          idOf(team2.player1) || oldMatch.team2_player1_id,
          idOf(team2.player2) || (format === 'doubles' ? oldMatch.team2_player2_id : null),
        ].filter(Boolean),
      };

      const perTeam = format === 'singles' ? 1 : 2;
      const allIds = [...lineup.team1, ...lineup.team2];

      if (
        ![1, 2].includes(winner) || !Number.isFinite(score1) || !Number.isFinite(score2) ||
        lineup.team1.length !== perTeam || lineup.team2.length !== perTeam ||
        new Set(allIds).size !== allIds.length
      ) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: 'Thông tin trận đấu không hợp lệ' });
      }

      // Check all players exist and belong to club
      const playersRes = await client.query(
        'SELECT * FROM players WHERE id = ANY($1) AND club_id = $2 FOR UPDATE',
        [allIds, clubId]
      );
      if (playersRes.rows.length !== allIds.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Có người chơi không thuộc CLB này' });
      }
      const rowsById = new Map(playersRes.rows.map((row) => [row.id, row]));

      // 3. Compute new rating delta if not passed
      let deltaTeam1 = num(team1.deltaRating);
      let deltaTeam2 = num(team2.deltaRating);
      if (!deltaTeam1 && !deltaTeam2) {
        const prefix = format === 'singles' ? 'singles' : 'doubles';
        const avg1 = lineup.team1.reduce((sum, id) => sum + parseFloat(rowsById.get(id)[`${prefix}_rating`]), 0) / lineup.team1.length;
        const avg2 = lineup.team2.reduce((sum, id) => sum + parseFloat(rowsById.get(id)[`${prefix}_rating`]), 0) / lineup.team2.length;
        const duprRes = calculateDuprMatchDelta({
          ratingTeam1: avg1,
          ratingTeam2: avg2,
          actualScoreTeam1: score1,
          actualScoreTeam2: score2,
          importanceFactor: importance === 'league' ? 1.0 : 0.8,
        });
        deltaTeam1 = duprRes.deltaTeam1;
        deltaTeam2 = duprRes.deltaTeam2;
      }

      const teamInfo = (t, defaultDelta) => ({
        startRatingAvg: num(t.startRatingAvg),
        deltaRating: Math.max(-1, Math.min(1, num(t.deltaRating, defaultDelta))),
        newRatingAvg: num(t.newRatingAvg),
      });

      const updaterName = (membership && membership.name) || (req.user && req.user.name) || 'Quản trị viên';
      const updaterRole = membership && membership.role === 'owner' ? 'Chủ CLB' : 'Quản trị viên';
      const updatedAt = new Date();

      const oldDetails = typeof oldMatch.details === 'string' ? JSON.parse(oldMatch.details || '{}') : (oldMatch.details || {});
      const createdBy = oldDetails.createdBy || {
        userId: oldMatch.created_by_user_id || req.user.id,
        playerId: membership.id,
        name: updaterName,
      };

      const details = {
        team1: teamInfo(team1, deltaTeam1),
        team2: teamInfo(team2, deltaTeam2),
        expectedWinProbTeam1: num(body.expectedWinProbTeam1, 0.5),
        expectedWinProbTeam2: num(body.expectedWinProbTeam2, 0.5),
        actualPointsShareTeam1: num(body.actualPointsShareTeam1, (score1 + score2 > 0 ? score1 / (score1 + score2) : 0.5)),
        expectedPointsShareTeam1: num(body.expectedPointsShareTeam1, 0.5),
        marginOfVictoryFactor: num(body.marginOfVictoryFactor, 1),
        createdBy,
        lastUpdatedBy: {
          name: updaterName,
          role: updaterRole,
          at: updatedAt.toISOString(),
        },
        confirmedPlayerIds: [],
        appeals: [],
      };

      // 4. Update match row
      const updateRes = await client.query(`
        UPDATE matches
        SET match_date = $1,
            format = $2,
            importance = $3,
            court_name = $4,
            winner = $5,
            sets = $6,
            total_score_team1 = $7,
            total_score_team2 = $8,
            team1_player1_id = $9,
            team1_player2_id = $10,
            team2_player1_id = $11,
            team2_player2_id = $12,
            delta_rating = $13,
            notes = $14,
            details = $15,
            updated_by_name = $16,
            updated_at = $17
        WHERE id = $18
        RETURNING *
      `, [
        matchDate, format, importance, courtName, winner, JSON.stringify(sets),
        score1, score2,
        lineup.team1[0], lineup.team1[1] || null, lineup.team2[0], lineup.team2[1] || null,
        Math.abs(details.team1.deltaRating), notes || '', JSON.stringify(details),
        `${updaterName} (${updaterRole})`, updatedAt,
        oldMatch.id
      ]);

      // 5. Apply new results to players
      const prefix = format === 'singles' ? 'singles' : 'doubles';
      const applyResult = async (playerId, delta, won, pointDiff) => {
        const p = rowsById.get(playerId);
        const played = p[`matches_played_${prefix}`] + 1;
        const rating = Math.max(MIN_RATING, Math.min(MAX_RATING, parseFloat(p[`${prefix}_rating`]) + delta));

        await client.query(`
          UPDATE players
          SET ${prefix}_rating = $1,
              matches_played_${prefix} = $2,
              wins_${prefix} = wins_${prefix} + $3,
              losses_${prefix} = losses_${prefix} + $4,
              provisional_${prefix} = $5,
              point_differential = point_differential + $6,
              updated_at = NOW()
          WHERE id = $7
        `, [rating.toFixed(3), played, won ? 1 : 0, won ? 0 : 1, played < PROVISIONAL_MATCHES, pointDiff, playerId]);
      };

      for (const id of lineup.team1) await applyResult(id, details.team1.deltaRating, winner === 1, score1 - score2);
      for (const id of lineup.team2) await applyResult(id, details.team2.deltaRating, winner === 2, score2 - score1);

      // Re-increment match_count because rollback decremented it
      await client.query('UPDATE clubs SET match_count = match_count + 1 WHERE id = $1', [clubId]);

      // Recalculate streak & form for all affected players (both old lineup and new lineup)
      const allAffectedIds = new Set([...allIds, oldMatch.team1_player1_id, oldMatch.team1_player2_id, oldMatch.team2_player1_id, oldMatch.team2_player2_id].filter(Boolean));
      for (const pid of allAffectedIds) {
        await recalculatePlayerStreakAndForm(client, clubId, pid);
      }

      // Notify players of the update
      for (const pid of allIds) {
        const p = rowsById.get(pid);
        if (p && p.user_id) {
          const notifId = newId('notif');
          await client.query(`
            INSERT INTO notifications (id, user_id, club_id, type, title, message, data, read)
            VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
          `, [
            notifId,
            p.user_id,
            clubId,
            'match_result',
            'Kết quả trận đấu đã được cập nhật',
            `Kết quả trận đấu (${courtName}) đã được ${updaterName} cập nhật lại. Tỉ số mới: ${score1} - ${score2}. Vui lòng kiểm tra và xác nhận lại.`,
            JSON.stringify({
              matchId: oldMatch.id,
              clubId,
              score1,
              score2,
              courtName,
            }),
          ]);
        }
      }

      const playersById = await loadPlayersById(client, updateRes.rows);
      await client.query('COMMIT');

      res.json({ success: true, data: toMatch(updateRes.rows[0], playersById) });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('updateMatch error:', err);
      res.status(500).json({ success: false, error: 'Database transaction error' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('updateMatch outer error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

// POST /api/matches/:id/confirm
async function confirmMatch(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const matchRes = await db.query('SELECT * FROM matches WHERE id = $1', [id]);
    if (matchRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy trận đấu' });
    }
    const match = matchRes.rows[0];

    // Check if user is a participant in this match
    const participantIds = [match.team1_player1_id, match.team1_player2_id, match.team2_player1_id, match.team2_player2_id].filter(Boolean);
    const playerRes = await db.query(
      `SELECT * FROM players WHERE club_id = $1 AND user_id = $2 AND id = ANY($3) AND removed_at IS NULL`,
      [match.club_id, userId, participantIds]
    );

    let targetPlayer = playerRes.rows[0];
    if (!targetPlayer) {
      // Check if user is manager confirming on behalf of a player
      const membership = await getMembership(userId, match.club_id);
      if (membership && isManager(membership) && req.body.playerId && participantIds.includes(req.body.playerId)) {
        const customPlayerRes = await db.query('SELECT * FROM players WHERE id = $1', [req.body.playerId]);
        targetPlayer = customPlayerRes.rows[0];
      }
    }

    if (!targetPlayer) {
      return res.status(403).json({ success: false, error: 'Bạn không phải là người tham gia trong trận đấu này' });
    }

    const details = typeof match.details === 'string' ? JSON.parse(match.details || '{}') : (match.details || {});
    let confirmedPlayerIds = Array.isArray(details.confirmedPlayerIds) ? [...details.confirmedPlayerIds] : [];
    let appeals = Array.isArray(details.appeals) ? [...details.appeals] : [];

    if (!confirmedPlayerIds.includes(targetPlayer.id)) {
      confirmedPlayerIds.push(targetPlayer.id);
    }
    // Remove this player's appeal if previously appealed
    appeals = appeals.filter((a) => a.playerId !== targetPlayer.id);

    details.confirmedPlayerIds = confirmedPlayerIds;
    details.appeals = appeals;

    await db.query('UPDATE matches SET details = $1 WHERE id = $2', [JSON.stringify(details), id]);

    // Mark related notification as read if any
    await db.query(
      `UPDATE notifications SET read = TRUE WHERE user_id = $1 AND (data->>'matchId') = $2`,
      [userId, id]
    ).catch(() => {});

    const playersById = await loadPlayersById(db, [match]);
    match.details = details;
    res.json({ success: true, data: toMatch(match, playersById) });
  } catch (err) {
    console.error('confirmMatch error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

// POST /api/matches/:id/appeal
async function appealMatch(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: 'Vui lòng cung cấp lý do kháng cáo' });
    }

    const matchRes = await db.query('SELECT * FROM matches WHERE id = $1', [id]);
    if (matchRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy trận đấu' });
    }
    const match = matchRes.rows[0];

    const participantIds = [match.team1_player1_id, match.team1_player2_id, match.team2_player1_id, match.team2_player2_id].filter(Boolean);
    const playerRes = await db.query(
      `SELECT * FROM players WHERE club_id = $1 AND user_id = $2 AND id = ANY($3) AND removed_at IS NULL`,
      [match.club_id, userId, participantIds]
    );

    let targetPlayer = playerRes.rows[0];
    if (!targetPlayer) {
      const membership = await getMembership(userId, match.club_id);
      if (membership && isManager(membership) && req.body.playerId && participantIds.includes(req.body.playerId)) {
        const customPlayerRes = await db.query('SELECT * FROM players WHERE id = $1', [req.body.playerId]);
        targetPlayer = customPlayerRes.rows[0];
      }
    }

    if (!targetPlayer) {
      return res.status(403).json({ success: false, error: 'Bạn không phải là người tham gia trong trận đấu này' });
    }

    const details = typeof match.details === 'string' ? JSON.parse(match.details || '{}') : (match.details || {});
    let confirmedPlayerIds = Array.isArray(details.confirmedPlayerIds) ? [...details.confirmedPlayerIds] : [];
    let appeals = Array.isArray(details.appeals) ? [...details.appeals] : [];

    // Remove from confirmed
    confirmedPlayerIds = confirmedPlayerIds.filter((pid) => pid !== targetPlayer.id);

    // Add or update appeal
    appeals = appeals.filter((a) => a.playerId !== targetPlayer.id);
    appeals.push({
      playerId: targetPlayer.id,
      playerName: targetPlayer.name,
      reason: reason.trim(),
      createdAt: new Date().toISOString(),
    });

    details.confirmedPlayerIds = confirmedPlayerIds;
    details.appeals = appeals;

    await db.query('UPDATE matches SET details = $1 WHERE id = $2', [JSON.stringify(details), id]);

    // Notify club managers about the appeal
    const managersRes = await db.query(
      `SELECT user_id FROM players WHERE club_id = $1 AND role IN ('owner', 'admin') AND user_id IS NOT NULL AND removed_at IS NULL`,
      [match.club_id]
    );
    for (const mgr of managersRes.rows) {
      const notifId = newId('notif');
      await db.query(`
        INSERT INTO notifications (id, user_id, club_id, type, title, message, data, read)
        VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
      `, [
        notifId,
        mgr.user_id,
        match.club_id,
        'match_appeal',
        `Kháng cáo kết quả trận đấu từ ${targetPlayer.name}`,
        `VĐV ${targetPlayer.name} đã kháng cáo kết quả trận đấu (${match.court_name || 'Sân CLB'}): "${reason.trim()}". Vui lòng kiểm tra và xử lý.`,
        JSON.stringify({
          matchId: id,
          clubId: match.club_id,
          playerId: targetPlayer.id,
          playerName: targetPlayer.name,
          reason: reason.trim(),
        }),
      ]);
    }

    const playersById = await loadPlayersById(db, [match]);
    match.details = details;
    res.json({ success: true, data: toMatch(match, playersById) });
  } catch (err) {
    console.error('appealMatch error:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

module.exports = {
  getMatches,
  recordMatch,
  createMatch: recordMatch,
  deleteMatch,
  updateMatch,
  confirmMatch,
  appealMatch,
};

