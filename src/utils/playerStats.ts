import { MatchResult, Player } from '../types/pickleball';

type MatchTeam = MatchResult['team1'];

export const playerDisplayId = (player: Player): string =>
  `ACE${player.id.replace(/[^0-9]/g, '').padStart(5, '0')}`;

// Generated avatars are limited to cheerful expressions (the full set includes sad and angry faces)
const HAPPY_OPTIONS = 'mouth=smile,twinkle&eyes=happy,default,wink&eyebrows=default,defaultNatural,raisedExcited';

export const happyAvatar = (seed: string): string =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&${HAPPY_OPTIONS}`;

export const avatarUrl = (player: Pick<Player, 'name' | 'avatar'>): string =>
  player.avatar || happyAvatar(player.name);

export const doublesWinRate = (player: Player): number =>
  player.matchesPlayedDoubles > 0
    ? Math.round((player.winsDoubles / player.matchesPlayedDoubles) * 100)
    : 0;

// Matches synced from the backend can carry different ids, so fall back to the name
export const isSamePlayer = (a: Player | undefined, b: Player): boolean =>
  !!a && (a.id === b.id || a.name === b.name);

export const isOnTeam = (team: MatchTeam, player: Player): boolean =>
  isSamePlayer(team.player1, player) || isSamePlayer(team.player2, player);

export const matchesOfPlayer = (matches: MatchResult[], player: Player): MatchResult[] =>
  matches.filter((m) => isOnTeam(m.team1, player) || isOnTeam(m.team2, player));

const byPlayedOrder = (a: MatchResult, b: MatchResult): number =>
  (new Date(a.date).getTime() - new Date(b.date).getTime()) ||
  (new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime()) ||
  a.id.localeCompare(b.id);

/**
 * The members who played in `matches`, with their record (wins, losses, point
 * difference, streak, form) recounted from those matches only. Ratings stay current;
 * `rankDelta` carries the sign of the doubles rating change over these matches.
 */
export function playersWithRecordIn(players: Player[], matches: MatchResult[]): Player[] {
  const ordered = [...matches].sort(byPlayedOrder);

  return players.flatMap((player) => {
    const played = ordered.filter((m) => isOnTeam(m.team1, player) || isOnTeam(m.team2, player));
    if (played.length === 0) return [];

    const record = {
      matchesPlayedDoubles: 0, winsDoubles: 0, lossesDoubles: 0,
      matchesPlayedSingles: 0, winsSingles: 0, lossesSingles: 0,
      pointDifferential: 0, streak: 0, doublesDelta: 0,
    };
    const results: ('W' | 'L')[] = [];

    played.forEach((m) => {
      const onTeam1 = isOnTeam(m.team1, player);
      const won = m.winner === (onTeam1 ? 1 : 2);
      const diff = (m.totalScoreTeam1 - m.totalScoreTeam2) * (onTeam1 ? 1 : -1);
      if (m.format === 'singles') {
        record.matchesPlayedSingles += 1;
        record[won ? 'winsSingles' : 'lossesSingles'] += 1;
      } else {
        record.matchesPlayedDoubles += 1;
        record[won ? 'winsDoubles' : 'lossesDoubles'] += 1;
        record.doublesDelta += (onTeam1 ? m.team1 : m.team2).deltaRating || 0;
      }
      record.pointDifferential += diff;
      record.streak = won ? Math.max(record.streak, 0) + 1 : Math.min(record.streak, 0) - 1;
      results.push(won ? 'W' : 'L');
    });

    const { doublesDelta, ...counts } = record;
    return [{
      ...player,
      ...counts,
      form: results.reverse().slice(0, 5), // most recent first, as the server keeps it
      rankDelta: Math.sign(doublesDelta),
    }];
  });
}

export interface RelationStat {
  player: Player;
  played: number;
  wins: number;
  winRate: number;
}

/**
 * Win/loss record of `player` alongside each teammate and against each opponent.
 * Both lists are sorted by matches played, most first.
 */
export function computeRelations(
  matches: MatchResult[],
  player: Player
): { teammates: RelationStat[]; opponents: RelationStat[] } {
  const teammates = new Map<string, RelationStat>();
  const opponents = new Map<string, RelationStat>();

  const add = (map: Map<string, RelationStat>, other: Player | undefined, won: boolean) => {
    if (!other || isSamePlayer(other, player)) return;
    const stat = map.get(other.id) || { player: other, played: 0, wins: 0, winRate: 0 };
    stat.played += 1;
    if (won) stat.wins += 1;
    stat.winRate = Math.round((stat.wins / stat.played) * 100);
    map.set(other.id, stat);
  };

  matchesOfPlayer(matches, player).forEach((m) => {
    const onTeam1 = isOnTeam(m.team1, player);
    const mine = onTeam1 ? m.team1 : m.team2;
    const theirs = onTeam1 ? m.team2 : m.team1;
    const won = onTeam1 ? m.winner === 1 : m.winner === 2;

    add(teammates, mine.player1, won);
    add(teammates, mine.player2, won);
    add(opponents, theirs.player1, won);
    add(opponents, theirs.player2, won);
  });

  const byPlayed = (a: RelationStat, b: RelationStat) => b.played - a.played;
  return {
    teammates: [...teammates.values()].sort(byPlayed),
    opponents: [...opponents.values()].sort(byPlayed),
  };
}
