import React from 'react';
import { CalendarDays } from 'lucide-react';
import { usePickleball } from '../context/PickleballContext';
import { MatchDayMode, matchesOnDay, todayKey, yesterdayKey } from '../utils/matchDayFilter';

/** Day picker shared by the standings screens; the same day applies to the match history. */
export const MatchDayFilterBar: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { matches, matchDayFilter, setMatchDayFilter } = usePickleball();
  const { mode, customDate } = matchDayFilter;

  const chip = (value: MatchDayMode, label: string, count: number) => {
    const active = mode === value;
    return (
      <button
        type="button"
        onClick={() => setMatchDayFilter({ mode: value, customDate })}
        style={{
          padding: compact ? '5px 10px' : '6px 12px',
          borderRadius: 8,
          fontSize: compact ? '0.74rem' : '0.8rem',
          fontWeight: 800,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          border: active ? '1px solid #059669' : '1px solid #e2e8f0',
          background: active ? '#ecfdf5' : '#f8fafc',
          color: active ? '#059669' : '#475569',
        }}
      >
        {label} ({count})
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: compact ? 6 : 8 }}>
      <span style={{ fontSize: compact ? '0.74rem' : '0.82rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
        <CalendarDays size={15} color="#059669" />
        Theo ngày:
      </span>
      {chip('all', 'Tất cả', matches.length)}
      {chip('today', 'Hôm nay', matchesOnDay(matches, todayKey()).length)}
      {chip('yesterday', 'Hôm qua', matchesOnDay(matches, yesterdayKey()).length)}
      <input
        type="date"
        value={customDate}
        aria-label="Chọn ngày"
        onChange={(e) => setMatchDayFilter(e.target.value ? { mode: 'custom', customDate: e.target.value } : { mode: 'all', customDate: '' })}
        style={{
          padding: compact ? '4px 8px' : '5px 10px',
          borderRadius: 8,
          border: mode === 'custom' ? '1px solid #059669' : '1px solid #cbd5e1',
          background: mode === 'custom' ? '#ecfdf5' : '#ffffff',
          fontSize: compact ? '0.74rem' : '0.8rem',
          fontWeight: 700,
          color: '#1e293b',
          cursor: 'pointer',
        }}
      />
    </div>
  );
};
