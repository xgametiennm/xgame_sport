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
const isSamePlayer = (a: Player | undefined, b: Player): boolean =>
  !!a && (a.id === b.id || a.name === b.name);

export const isOnTeam = (team: MatchTeam, player: Player): boolean =>
  isSamePlayer(team.player1, player) || isSamePlayer(team.player2, player);

export const matchesOfPlayer = (matches: MatchResult[], player: Player): MatchResult[] =>
  matches.filter((m) => isOnTeam(m.team1, player) || isOnTeam(m.team2, player));

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
