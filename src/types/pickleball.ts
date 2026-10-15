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
  updatedByName?: string;
  updatedAt?: string;
  updatedByRole?: string;
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
  defaultClubId?: string | null;
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

export interface LiveCourtPlayer {
  id: string;
  name: string;
  avatar: string;
  doublesRating?: number;
}

export interface LiveCourtState {
  id: string;
  courtName: string;
  clubId?: string;
  clubName?: string;
  scoringType: ScoringType;
  targetScore: number;
  score1: number;
  score2: number;
  serverNumber: 1 | 2;
  servingTeam: 1 | 2;
  t1Right: LiveCourtPlayer;
  t1Left: LiveCourtPlayer;
  t2Right: LiveCourtPlayer;
  t2Left: LiveCourtPlayer;
  activeServerId: string;
  isGameOver: boolean;
  isActive?: boolean;
  winnerTeam?: 1 | 2 | null;
  lastAction?: string;
  scorerName?: string;
  spectatorsCount?: number;
  updatedAt: string;
}

export type TournamentFormat = 'doubles' | 'singles';
export type TournamentType = 'group_and_knockout' | 'knockout_only' | 'group_only';
export type PairingMethod = 'random' | 'balanced' | 'manual';

export interface TournamentTeam {
  id: string;
  name: string;
  player1: Player;
  player2?: Player;
  seed?: number;
  groupName?: string;
}

export interface TournamentMatch {
  id: string;
  stage: 'group' | 'knockout';
  groupName?: string;
  roundIndex: number;
  matchIndex: number;
  roundName: string;
  title?: string;
  team1?: TournamentTeam | null;
  team2?: TournamentTeam | null;
  score1?: number;
  score2?: number;
  winner?: 1 | 2 | null;
  nextMatchId?: string;
  nextMatchSlot?: 1 | 2;
  courtName?: string;
  completed: boolean;
}

export interface GroupStanding {
  team: TournamentTeam;
  played: number;
  won: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  rank: number;
  points: number;
}

export interface TournamentData {
  id: string;
  clubId: string;
  name: string;
  format: TournamentFormat;
  type: TournamentType;
  pairingMethod: PairingMethod;
  teams: TournamentTeam[];
  groups: {
    name: string;
    teamIds: string[];
  }[];
  groupMatches: TournamentMatch[];
  knockoutMatches: TournamentMatch[];
  targetScore: number;
  currentPhase: 'setup' | 'pairing' | 'drawing' | 'group_stage' | 'knockout_stage' | 'finished';
  advancePerGroup: number;
  champion?: TournamentTeam | null;
  runnerUp?: TournamentTeam | null;
  thirdPlace?: TournamentTeam | null;
  createdAt: string;
  updatedAt: string;
}


