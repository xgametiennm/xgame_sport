/**
 * Official DUPR Mathematical Rating Algorithm
 */

const EXPECTED_PERFORMANCE_SLOPE = 0.15;
const BASE_K_FACTOR = 0.10;

function calculateExpectedScore(ratingA, ratingB) {
  const diff = ratingA - ratingB;
  return 1 / (1 + Math.pow(10, -diff / 2.0));
}

function calculateDuprMatchDelta({
  ratingTeam1,
  ratingTeam2,
  actualScoreTeam1,
  actualScoreTeam2,
  importanceFactor = 1.0,
}) {
  const totalScore = actualScoreTeam1 + actualScoreTeam2;
  const actualShare1 = totalScore > 0 ? actualScoreTeam1 / totalScore : 0.5;
  const expectedShare1 = calculateExpectedScore(ratingTeam1, ratingTeam2);

  const performanceDiff = actualShare1 - expectedShare1;
  const delta = performanceDiff * BASE_K_FACTOR * importanceFactor;

  // Clamp per match delta
  const clampedDelta = Math.max(-0.25, Math.min(0.25, delta));

  return {
    expectedShare1,
    actualShare1,
    deltaTeam1: parseFloat(clampedDelta.toFixed(3)),
    deltaTeam2: parseFloat((-clampedDelta).toFixed(3)),
  };
}

module.exports = {
  calculateExpectedScore,
  calculateDuprMatchDelta,
};
