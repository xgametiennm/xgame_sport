import React from 'react';
import { CalendarDays } from 'lucide-react';
import { FundPeriod, PeriodPreset } from '../../utils/fundPeriod';
import { inputStyle } from './shared';

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'thisMonth', label: 'Tháng này' },
  { value: 'lastMonth', label: 'Tháng trước' },
  { value: 'month', label: 'Chọn tháng' },
  { value: 'range', label: 'Khoảng ngày' },
  { value: 'all', label: 'Tất cả' },
];

/** One row of period controls; the same period drives the expense list, the report and the export. */
export const PeriodPicker: React.FC<{ value: FundPeriod; onChange: (p: FundPeriod) => void }> = ({ value, onChange }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
    <CalendarDays size={16} color="#047857" />
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', background: '#f1f5f9', padding: 3, borderRadius: 10, gap: 3 }}>
      {PRESETS.map((p) => {
        const active = value.preset === p.value;
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange({ ...value, preset: p.value })}
            aria-pressed={active}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: 'none',
              fontSize: '0.76rem',
              fontWeight: 800,
              cursor: 'pointer',
              background: active ? '#ffffff' : 'transparent',
              color: active ? '#0f172a' : '#64748b',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
    {value.preset === 'month' && (
      <input
        type="month"
        value={value.month}
        onChange={(e) => e.target.value && onChange({ ...value, month: e.target.value })}
        aria-label="Tháng"
        style={{ ...inputStyle, width: 'auto', padding: '6px 10px' }}
      />
    )}
    {value.preset === 'range' && (
      <>
        <input type="date" value={value.from} onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} aria-label="Từ ngày" style={{ ...inputStyle, width: 'auto', padding: '6px 10px' }} />
        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>→</span>
        <input type="date" value={value.to} onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} aria-label="Đến ngày" style={{ ...inputStyle, width: 'auto', padding: '6px 10px' }} />
      </>
    )}
  </div>
);
