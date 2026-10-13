const db = require('../config/db');
const { toPlayer } = require('./playerController');
const { newId } = require('../middleware/auth');

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
    const details = {
      team1: teamInfo(team1),
      team2: teamInfo(team2),
      expectedWinProbTeam1: num(body.expectedWinProbTeam1, 0.5),
      expectedWinProbTeam2: num(body.expectedWinProbTeam2, 0.5),
      actualPointsShareTeam1: num(body.actualPointsShareTeam1, 0.5),
      expectedPointsShareTeam1: num(body.expectedPointsShareTeam1, 0.5),
      marginOfVictoryFactor: num(body.marginOfVictoryFactor, 1),
    };

    const matchDate = body.date && !Number.isNaN(Date.parse(body.date)) ? new Date(body.date) : new Date();
    const matchId = newId('match');

    const insertRes = await client.query(`
      INSERT INTO matches (
        id, club_id, match_date, format, importance, court_name, winner, sets,
        total_score_team1, total_score_team2,
        team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id,
        delta_rating, notes, details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
      matchId, clubId, matchDate, format, importance, courtName, winner, JSON.stringify(sets),
      score1, score2,
      lineup.team1[0], lineup.team1[1] || null, lineup.team2[0], lineup.team2[1] || null,
      Math.abs(details.team1.deltaRating), notes || '', JSON.stringify(details),
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

module.exports = {
  getMatches,
  recordMatch,
  createMatch: recordMatch,
};
