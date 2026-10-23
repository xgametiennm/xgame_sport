import { MatchResult } from '../types/pickleball';

// Partner round robin ("xoay cặp") for doubles: every member partners every other member
// exactly once, and each match puts two such partnerships against each other.
//
// The partnerships come from the circle method: with an even number of members it splits
// them into pairs in n - 1 rounds so that every pair appears exactly once (an odd group
// gets a bye, whose partner sits the round out). Two pairs of the same round make a match,
// so nobody plays twice in a round. When a round has an odd number of pairs, the one left
// over is matched with a left-over pair from another round that shares nobody with it.
// A perfect schedule exists only for 4k or 4k + 1 members; otherwise at most one pair is
// left without opponents and plays against two members who have partnered before.

export type Pair = [string, string];

export interface RoundRobinMatch {
  round: number;
  team1: Pair;
  team2: Pair;
}

export interface RoundRobinPlan {
  matches: RoundRobinMatch[];
  rounds: number;
  // Partnerships that appear twice because a perfect schedule is impossible for this size
  repeatedPairs: number;
}

const shuffle = <T,>(items: T[]): T[] => {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};

const disjoint = (a: string[], b: string[]) => !a.some((id) => b.includes(id));

/** Partnerships of each round, by the circle method. */
function partnerRounds(memberIds: string[]): Pair[][] {
  const circle: (string | null)[] = shuffle(memberIds);
  if (circle.length % 2) circle.push(null); // bye
  const n = circle.length;
  const rounds: Pair[][] = [];

  for (let r = 0; r < n - 1; r++) {
    const pairs: Pair[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = circle[i];
      const b = circle[n - 1 - i];
      if (a && b) pairs.push([a, b]);
    }
    rounds.push(shuffle(pairs));
    // Keep the first seat fixed and rotate everyone else one place
    circle.splice(1, 0, circle.pop()!);
  }
  return rounds;
}

/** Pairs up as many left-over partnerships as possible (each pair of pairs sharing nobody). */
function matchLeftovers(leftovers: Pair[]): { matched: [Pair, Pair][]; unmatched: Pair[] } {
  let best = { matched: [] as [Pair, Pair][], unmatched: leftovers };
  // Few left-overs at most (one per round), so randomised greedy attempts find the best quickly
  for (let attempt = 0; attempt < 200 && best.unmatched.length > leftovers.length % 2; attempt++) {
    const pool = shuffle(leftovers);
    const matched: [Pair, Pair][] = [];
    const unmatched: Pair[] = [];
    while (pool.length) {
      const pair = pool.shift()!;
      const index = pool.findIndex((other) => disjoint(pair, other));
      if (index >= 0) matched.push([pair, pool.splice(index, 1)[0]]);
      else unmatched.push(pair);
    }
    if (unmatched.length < best.unmatched.length) best = { matched, unmatched };
  }
  return best;
}

export function buildRoundRobin(memberIds: string[]): RoundRobinPlan {
  const rounds = partnerRounds(memberIds);
  const matches: RoundRobinMatch[] = [];
  const leftovers: Pair[] = [];

  rounds.forEach((pairs, index) => {
    for (let k = 0; k + 1 < pairs.length; k += 2) {
      matches.push({ round: index + 1, team1: pairs[k], team2: pairs[k + 1] });
    }
    if (pairs.length % 2) leftovers.push(pairs[pairs.length - 1]);
  });

  const { matched, unmatched } = matchLeftovers(leftovers);
  const extra: [Pair, Pair][] = [...matched];

  // A pair with no possible opponents faces the two other members who have played least
  const played = new Map(memberIds.map((id) => [id, 0]));
  [...matches.flatMap((m) => [...m.team1, ...m.team2]), ...extra.flat(2)].forEach((id) => played.set(id, played.get(id)! + 1));
  unmatched.forEach((pair) => {
    const others = shuffle(memberIds.filter((id) => !pair.includes(id)))
      .sort((a, b) => played.get(a)! - played.get(b)!)
      .slice(0, 2);
    if (others.length < 2) return;
    others.forEach((id) => played.set(id, played.get(id)! + 1));
    extra.push([pair, [others[0], others[1]]]);
  });

  // Extra matches go into rounds after the regular ones, sharing a round when nobody overlaps
  const extraRounds: string[][] = [];
  extra.forEach(([team1, team2]) => {
    const lineup = [...team1, ...team2];
    let slot = extraRounds.findIndex((ids) => disjoint(ids, lineup));
    if (slot < 0) slot = extraRounds.push([]) - 1;
    extraRounds[slot].push(...lineup);
    matches.push({ round: rounds.length + slot + 1, team1, team2 });
  });

  matches.sort((a, b) => a.round - b.round);
  return { matches, rounds: rounds.length + extraRounds.length, repeatedPairs: unmatched.length };
}

/** Matches, rounds and matches per member of a round robin of `size` members (no randomness). */
export function roundRobinSummary(size: number): { matches: number; perMember: number; perfect: boolean } {
  const pairs = (size * (size - 1)) / 2;
  const perfect = size % 4 === 0 || size % 4 === 1;
  return { matches: Math.ceil(pairs / 2), perMember: size - 1, perfect };
}

// ---------------------------------------------------------------------------
// Saved results. Each match of a round robin is stored with a note naming the event and
// carrying its code, so the event's ranking and history are rebuilt from the club's matches.

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const newRoundRobinCode = (): string =>
  'RR' + Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');

export const roundRobinNote = (name: string, code: string, round: number, rounds: number): string =>
  `${name} · Vòng ${round}/${rounds} · mã ${code}`;

const NOTE_PATTERN = /^(.*) · Vòng (\d+)\/(\d+) · mã (RR[A-Z0-9]{6})$/;

export interface RoundRobinNoteInfo {
  name: string;
  round: number;
  rounds: number;
  code: string;
}

export const parseRoundRobinNote = (notes?: string): RoundRobinNoteInfo | null => {
  const found = notes ? NOTE_PATTERN.exec(notes.trim()) : null;
  return found ? { name: found[1], round: Number(found[2]), rounds: Number(found[3]), code: found[4] } : null;
};

export interface RoundRobinEvent {
  code: string;
  name: string;
  date: string;
  matches: MatchResult[]; // in round order
}

/** Round robins found in the club's matches, newest first. */
export function roundRobinEvents(matches: MatchResult[]): RoundRobinEvent[] {
  const events = new Map<string, RoundRobinEvent>();
  matches.forEach((m) => {
    const info = parseRoundRobinNote(m.notes);
    if (!info) return;
    const event = events.get(info.code) || { code: info.code, name: info.name, date: m.date, matches: [] };
    event.matches.push(m);
    if (m.date < event.date) event.date = m.date;
    events.set(info.code, event);
  });
  const roundOf = (m: MatchResult) => parseRoundRobinNote(m.notes)!.round;
  return [...events.values()]
    .map((e) => ({
      ...e,
      matches: e.matches.sort((a, b) => roundOf(a) - roundOf(b) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
