import { GameFormat, MatchImportance, MatchResult, Player } from '../types/pickleball';
import { calculateDupr } from './duprCalculator';

interface BuildMatchInput {
  id: string;
  date: string;
  format: GameFormat;
  importance: MatchImportance;
  courtName: string;
  team1: [Player, Player | undefined];
  team2: [Player, Player | undefined];
  score1?: number;
  score2?: number;
  sets?: { team1: number; team2: number }[];
  bestOfSets?: 1 | 3;
  targetScore?: number;
  notes?: string;
}

/**
 * Runs the DUPR calculation for a match (1 set or multi-set) and returns the record to store.
 */
export function buildMatchResult(input: BuildMatchInput): MatchResult {
  const { format, importance } = input;
  const [p1, p2] = input.team1;
  const [p3, p4] = input.team2;

  const rating = (p: Player) => (format === 'doubles' ? p.doublesRating : p.singlesRating);
  const played = (p: Player) => (format === 'doubles' ? p.matchesPlayedDoubles : p.matchesPlayedSingles);

  const sets = (input.sets && input.sets.length > 0)
    ? input.sets
    : [{ team1: input.score1 ?? 11, team2: input.score2 ?? 8 }];

  const totalScoreTeam1 = sets.reduce((sum, s) => sum + s.team1, 0);
  const totalScoreTeam2 = sets.reduce((sum, s) => sum + s.team2, 0);
  const bestOfSets = input.bestOfSets || (sets.length > 1 ? 3 : 1);
  const targetScore: 11 | 15 | 21 = input.targetScore === 15 ? 15 : input.targetScore === 21 ? 21 : 11;

  const calc = calculateDupr({
    format,
    importance,
    targetScore,
    winByTwo: true,
    bestOfSets,
    t1p1Rating: rating(p1),
    t1p1Matches: played(p1),
    t1p2Rating: p2 ? rating(p2) : undefined,
    t1p2Matches: p2 ? played(p2) : undefined,
    t2p1Rating: rating(p3),
    t2p1Matches: played(p3),
    t2p2Rating: p4 ? rating(p4) : undefined,
    t2p2Matches: p4 ? played(p4) : undefined,
    sets,
  });

  return {
    id: input.id,
    date: input.date,
    format,
    importance,
    courtName: input.courtName,
    winner: calc.winner,
    sets,
    totalScoreTeam1,
    totalScoreTeam2,
    team1: {
      player1: p1,
      player2: p2,
      startRatingAvg: calc.t1AvgRating,
      deltaRating: calc.ratingDeltaTeam1,
      newRatingAvg: parseFloat((calc.t1AvgRating + calc.ratingDeltaTeam1).toFixed(3)),
    },
    team2: {
      player1: p3,
      player2: p4,
      startRatingAvg: calc.t2AvgRating,
      deltaRating: calc.ratingDeltaTeam2,
      newRatingAvg: parseFloat((calc.t2AvgRating + calc.ratingDeltaTeam2).toFixed(3)),
    },
    expectedWinProbTeam1: calc.expectedWinProb1,
    expectedWinProbTeam2: calc.expectedWinProb2,
    expectedPointsShareTeam1: calc.expectedPointsShare1,
    actualPointsShareTeam1: calc.actualPointsShare1,
    marginOfVictoryFactor: calc.marginOfVictoryFactor,
    notes: input.notes || calc.analysisExplanation,
  };
}
