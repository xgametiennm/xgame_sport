import { FundExpenseCategory, FundOverview, Player } from '../types/pickleball';

// Periods and money movements of the club fund, shared by the expense filter, the report
// and the Excel export. Days are 'yyyy-mm-dd' strings, so they compare as text.

export const EXPENSE_CATEGORIES: { value: FundExpenseCategory; label: string }[] = [
  { value: 'court', label: 'Thuê sân' },
  { value: 'balls', label: 'Bóng' },
  { value: 'drinks', label: 'Nước uống' },
  { value: 'prizes', label: 'Giải thưởng' },
  { value: 'other', label: 'Khác' },
];

export const categoryLabel = (value: string): string =>
  EXPENSE_CATEGORIES.find((c) => c.value === value)?.label || 'Khác';

export type PeriodPreset = 'thisMonth' | 'lastMonth' | 'month' | 'range' | 'all';

export interface FundPeriod {
  preset: PeriodPreset;
  month: string; // yyyy-mm, for 'month'
  from: string; // yyyy-mm-dd, for 'range'
  to: string;
}

export interface DayRange {
  from: string | null; // null: from the beginning
  to: string | null; // null: up to now
  label: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

const lastDayOf = (month: string): string => {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${pad(new Date(y, m, 0).getDate())}`;
};

const monthLabel = (month: string): string => {
  const [y, m] = month.split('-');
  return `tháng ${Number(m)}/${y}`;
};

const formatDay = (day: string): string => {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
};

export const defaultPeriod = (): FundPeriod => {
  const now = new Date();
  return { preset: 'thisMonth', month: monthKey(now), from: `${monthKey(now)}-01`, to: dayKey(now) };
};

export function periodRange(period: FundPeriod): DayRange {
  const now = new Date();
  switch (period.preset) {
    case 'thisMonth': {
      const month = monthKey(now);
      return { from: `${month}-01`, to: lastDayOf(month), label: monthLabel(month) };
    }
    case 'lastMonth': {
      const month = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      return { from: `${month}-01`, to: lastDayOf(month), label: monthLabel(month) };
    }
    case 'month':
      return { from: `${period.month}-01`, to: lastDayOf(period.month), label: monthLabel(period.month) };
    case 'range': {
      const [from, to] = period.from <= period.to ? [period.from, period.to] : [period.to, period.from];
      return { from, to, label: `${formatDay(from)} – ${formatDay(to)}` };
    }
    default:
      return { from: null, to: null, label: 'toàn bộ thời gian' };
  }
}

export const inRange = (day: string, range: DayRange): boolean =>
  (!range.from || day >= range.from) && (!range.to || day <= range.to);

// ---------------------------------------------------------------------------
// Money movements

export interface Movement {
  date: string;
  kind: 'in' | 'out';
  amount: number;
  text: string; // "An đóng Quỹ tháng 11" / the expense title
  note: string;
  category?: FundExpenseCategory; // expenses only
}

/** Every payment and expense, in date order (payments before expenses on the same day). */
export function fundMovements(fund: FundOverview, playerById: Map<string, Player>): Movement[] {
  const nameOf = (id: string) => playerById.get(id)?.name || 'Thành viên đã rời CLB';
  return [
    ...fund.campaigns.flatMap((c) => c.contributions.map((x): Movement => ({
      date: x.paidAt,
      kind: 'in',
      amount: x.amount,
      text: `${nameOf(x.playerId)} đóng ${c.name}`,
      note: x.note,
    }))),
    ...fund.expenses.map((e): Movement => ({
      date: e.spentAt,
      kind: 'out',
      amount: e.amount,
      text: e.title,
      note: e.note,
      category: e.category,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === 'in' ? -1 : 1));
}

export interface PeriodSummary {
  openingBalance: number; // in the fund when the period starts
  income: number;
  expense: number;
  closingBalance: number;
  movements: Movement[]; // inside the period
}

export function summarizePeriod(fund: FundOverview, movements: Movement[], range: DayRange): PeriodSummary {
  let opening = fund.totals.opening;
  let income = 0;
  let expense = 0;
  const inside: Movement[] = [];
  movements.forEach((m) => {
    const signed = m.kind === 'in' ? m.amount : -m.amount;
    if (range.from && m.date < range.from) {
      opening += signed;
    } else if (inRange(m.date, range)) {
      inside.push(m);
      if (m.kind === 'in') income += m.amount;
      else expense += m.amount;
    }
  });
  return { openingBalance: opening, income, expense, closingBalance: opening + income - expense, movements: inside };
}

export interface Bucket {
  key: string; // yyyy-mm-dd or yyyy-mm
  label: string; // axis label
  title: string; // tooltip title
  income: number;
  expense: number;
  balance: number; // in the fund at the end of the bucket
}

/**
 * The period split into days (up to ~2 months) or months, with every bucket present
 * (quiet days included) so the time axis stays even.
 */
export function bucketize(summary: PeriodSummary, range: DayRange): Bucket[] {
  const today = dayKey(new Date());
  const first = range.from || summary.movements[0]?.date || today;
  const last = range.to && range.to < today ? range.to : (range.to || today);
  const end = last < first ? first : last;
  const spanDays = (new Date(`${end}T12:00:00`).getTime() - new Date(`${first}T12:00:00`).getTime()) / 86400000;
  const byDay = spanDays <= 62;

  const buckets: Bucket[] = [];
  const cursor = new Date(`${first}T12:00:00`);
  if (!byDay) cursor.setDate(1);
  while (true) {
    const key = byDay ? dayKey(cursor) : monthKey(cursor);
    if (key > (byDay ? end : end.slice(0, 7))) break;
    buckets.push({
      key,
      label: byDay ? String(cursor.getDate()) : `T${cursor.getMonth() + 1}`,
      title: byDay
        ? cursor.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
        : `Tháng ${cursor.getMonth() + 1}/${cursor.getFullYear()}`,
      income: 0,
      expense: 0,
      balance: 0,
    });
    if (byDay) cursor.setDate(cursor.getDate() + 1);
    else cursor.setMonth(cursor.getMonth() + 1);
  }

  const index = new Map(buckets.map((b, i) => [b.key, i]));
  summary.movements.forEach((m) => {
    const bucket = buckets[index.get(byDay ? m.date : m.date.slice(0, 7)) ?? -1];
    if (!bucket) return;
    if (m.kind === 'in') bucket.income += m.amount;
    else bucket.expense += m.amount;
  });
  let balance = summary.openingBalance;
  buckets.forEach((b) => {
    balance += b.income - b.expense;
    b.balance = balance;
  });
  return buckets;
}

/** Spending per category inside the period, largest first. */
export function spendingByCategory(movements: Movement[]): { value: FundExpenseCategory; label: string; amount: number; count: number }[] {
  return EXPENSE_CATEGORIES
    .map((c) => {
      const items = movements.filter((m) => m.kind === 'out' && (m.category || 'other') === c.value);
      return { ...c, amount: items.reduce((sum, m) => sum + m.amount, 0), count: items.length };
    })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.amount - a.amount);
}
