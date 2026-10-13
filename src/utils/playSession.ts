import { GameFormat } from '../types/pickleball';

export type PlayMode = 'friendly' | 'tournament';

// 'auto': the system pairs members at random. 'manual': the organiser builds every match by hand.
export type PairingMode = 'auto' | 'manual';

export interface SessionMatch {
  id: string;
  time: string; // HH:mm
  court: number;
  team1: (string | null)[]; // player ids, null = empty slot
  team2: (string | null)[];
  score1: number | null;
  score2: number | null;
}

export interface PlaySession {
  format: GameFormat;
  mode: PlayMode;
  pairing?: PairingMode; // sessions saved before manual pairing existed are 'auto'
  memberIds: string[];
  date: string; // yyyy-mm-dd
  startTime: string;
  endTime: string;
  courts: number;
  matches: SessionMatch[];
}

// ~12 minutes of play plus a short break between matches
export const SLOT_MINUTES = 15;

export const playersPerTeam = (format: GameFormat): number => (format === 'doubles' ? 2 : 1);

export const isManualPairing = (session: PlaySession): boolean => session.pairing === 'manual';

export const addMinutes = (time: string, minutes: number): string => {
  const [h, m] = time.split(':').map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

export const hasResult = (match: SessionMatch): boolean =>
  match.score1 !== null && match.score2 !== null && match.score1 !== match.score2;

export const isLineupComplete = (match: SessionMatch): boolean =>
  [...match.team1, ...match.team2].every((id) => id !== null);

const lineupOf = (match: SessionMatch): (string | null)[] => [...match.team1, ...match.team2];

const shuffle = <T,>(items: T[]): T[] => {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};

/** How many matches each member is already scheduled in. */
export function scheduledCounts(session: PlaySession): Map<string, number> {
  const counts = new Map<string, number>(session.memberIds.map((id) => [id, 0]));
  session.matches.forEach((m) =>
    lineupOf(m).forEach((id) => {
      if (id && counts.has(id)) counts.set(id, counts.get(id)! + 1);
    })
  );
  return counts;
}

/** Members playing in another match that starts at the same time as `match`. */
export function busyAtSameTime(session: PlaySession, match: SessionMatch): Set<string> {
  const busy = new Set<string>();
  session.matches
    .filter((m) => m.id !== match.id && m.time === match.time)
    .forEach((m) => lineupOf(m).forEach((id) => id && busy.add(id)));
  return busy;
}

// Fair random picks: members with the fewest scheduled matches first, skipping `exclude`
function pickMembers(session: PlaySession, counts: Map<string, number>, exclude: Set<string>, howMany: number): string[] {
  return shuffle(session.memberIds.filter((id) => !exclude.has(id)))
    .sort((a, b) => counts.get(a)! - counts.get(b)!)
    .slice(0, howMany);
}

/**
 * Appends `count` matches to a session. With `empty`, the matches have no players yet
 * (manual pairing). Otherwise members are paired at random: those who have played the
 * fewest matches are picked first, and nobody is put on two courts in the same time slot.
 */
export function appendMatches(session: PlaySession, count: number, { empty = false } = {}): SessionMatch[] {
  const perTeam = playersPerTeam(session.format);
  const matches = [...session.matches];
  const counts = scheduledCounts(session);

  for (let i = 0; i < count; i++) {
    const last = matches[matches.length - 1];
    const sameSlot = !!last && last.court < session.courts;
    const time = !last ? session.startTime : sameSlot ? last.time : addMinutes(last.time, SLOT_MINUTES);
    const court = sameSlot ? last.court + 1 : 1;

    let lineup: (string | null)[] = [];
    if (!empty) {
      const busy = new Set(
        matches.filter((m) => m.time === time).flatMap(lineupOf).filter((id): id is string => !!id)
      );
      const picked = pickMembers(session, counts, busy, perTeam * 2);
      picked.forEach((id) => counts.set(id, counts.get(id)! + 1));
      lineup = shuffle(picked);
    }
    while (lineup.length < perTeam * 2) lineup.push(null);

    matches.push({
      id: `sm-${Date.now()}-${matches.length}-${i}`,
      time,
      court,
      team1: lineup.slice(0, perTeam),
      team2: lineup.slice(perTeam),
      score1: null,
      score2: null,
    });
  }

  return matches;
}

/**
 * Fills the empty slots of one match at random, keeping the players already placed.
 * Same fairness rules as automatic pairing.
 */
export function fillMatch(session: PlaySession, matchId: string): SessionMatch[] {
  return session.matches.map((match) => {
    if (match.id !== matchId) return match;

    const exclude = busyAtSameTime(session, match);
    lineupOf(match).forEach((id) => id && exclude.add(id));
    const emptySlots = lineupOf(match).filter((id) => id === null).length;
    const picked = pickMembers(session, scheduledCounts(session), exclude, emptySlots);

    const fill = (team: (string | null)[]) => team.map((id) => id ?? picked.shift() ?? null);
    return { ...match, team1: fill(match.team1), team2: fill(match.team2) };
  });
}
