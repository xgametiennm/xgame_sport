import { MatchResult } from '../types/pickleball';

// Which day of matches the history and the standings are showing. Shared between both
// screens, so a day picked in one carries over to the other.
export type MatchDayMode = 'all' | 'today' | 'yesterday' | 'custom';

export interface MatchDayFilter {
  mode: MatchDayMode;
  customDate: string; // yyyy-mm-dd, used when mode is 'custom'
}

export const ALL_DAYS: MatchDayFilter = { mode: 'all', customDate: '' };

/** yyyy-mm-dd of a date in the viewer's local timezone ('' if it cannot be read). */
export const localDateKey = (value?: string | Date): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const todayKey = (): string => localDateKey(new Date());

export const yesterdayKey = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateKey(d);
};

/** The day the filter selects, or '' for all days. */
export const selectedDayKey = (filter: MatchDayFilter): string =>
  filter.mode === 'today' ? todayKey()
    : filter.mode === 'yesterday' ? yesterdayKey()
    : filter.mode === 'custom' ? filter.customDate
    : '';

/** dd/mm/yyyy for a yyyy-mm-dd key. */
export const formatDayKey = (key: string): string => {
  const [y, m, d] = key.split('-');
  return y && m && d ? `${d}/${m}/${y}` : key;
};

// A match belongs to the day it was played, not the day its result was saved
export const matchesOnDay = (matches: MatchResult[], dayKey: string): MatchResult[] =>
  dayKey ? matches.filter((m) => localDateKey(m.date) === dayKey) : matches;
