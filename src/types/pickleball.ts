export type GameFormat = 'doubles' | 'singles';

export type MatchImportance = 'casual' | 'league' | 'sanctioned';

export type ScoringType = 'sideout' | 'rally';

export interface Player {
  id: string;
  userId?: string | null; // account this membership belongs to; empty for guests added by a manager
  name: string;
  email?: string;
  avatar?: string;
  doublesRating: number;
  singlesRating: number;
  provisionalDoubles: boolean; // < 10 matches
  provisionalSingles: boolean;
  matchesPlayedDoubles: number;
  matchesPlayedSingles: number;
  winsDoubles: number;
  lossesDoubles: number;
  winsSingles: number;
  lossesSingles: number;
  pointDifferential: number;
  streak: number; // positive for win streak, negative for loss streak
  clubId?: string;
  form: ('W' | 'L')[]; // last 5 matches
  rankDelta?: number; // +/- rank change
  role?: ClubRole; // club permission, defaults to 'member'
}

export type ClubRole = 'owner' | 'admin' | 'member';

export interface SetScore {
  team1: number;
  team2: number;
}

export interface MatchResult {
  id: string;
  date: string;
  format: GameFormat;
  importance: MatchImportance;
  team1: {
    player1: Player;
    player2?: Player;
    startRatingAvg: number;
    deltaRating: number;
    newRatingAvg: number;
  };
  team2: {
    player1: Player;
    player2?: Player;
    startRatingAvg: number;
    deltaRating: number;
    newRatingAvg: number;
  };
  sets: SetScore[];
  winner: 1 | 2;
  totalScoreTeam1: number;
  totalScoreTeam2: number;
  expectedWinProbTeam1: number; // 0 to 1
  expectedWinProbTeam2: number; // 0 to 1
  actualPointsShareTeam1: number; // 0 to 1
  expectedPointsShareTeam1: number; // 0 to 1
  marginOfVictoryFactor: number;
  notes?: string;
  courtName?: string;
  clubId?: string;
}

export interface DuprCalcInput {
  format: GameFormat;
  importance: MatchImportance;
  targetScore: 11 | 15 | 21;
  winByTwo: boolean;
  bestOfSets: 1 | 3;
  // Team 1
  t1p1Rating: number;
  t1p1Matches: number;
  t1p2Rating?: number;
  t1p2Matches?: number;
  // Team 2
  t2p1Rating: number;
  t2p1Matches: number;
  t2p2Rating?: number;
  t2p2Matches?: number;
  // Scores
  sets: SetScore[];
}

export interface DuprCalcOutput {
  t1AvgRating: number;
  t2AvgRating: number;
  ratingDiff: number; // t1 - t2
  expectedWinProb1: number;
  expectedWinProb2: number;
  expectedPointsShare1: number;
  expectedPointsShare2: number;
  actualPointsShare1: number;
  actualPointsShare2: number;
  winner: 1 | 2;
  ratingDeltaTeam1: number;
  ratingDeltaTeam2: number;
  marginOfVictoryFactor: number;
  // Individual deltas
  t1p1Delta: number;
  t1p1New: number;
  t1p2Delta?: number;
  t1p2New?: number;
  t2p1Delta: number;
  t2p1New: number;
  t2p2Delta?: number;
  t2p2New?: number;
  analysisExplanation: string;
}

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
}

export interface ClubInfo {
  id: string;
  name: string;
  location: string;
  description: string;
  memberCount: number;
  matchCount: number;
  courtsCount: number;
  flagship: boolean;
  joinCode: string; // shared with people invited to join
  myRole: ClubRole; // the signed-in user's role in this club
}
