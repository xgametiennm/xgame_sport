import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { FundOverview, Player } from '../../types/pickleball';
import { Bucket, bucketize, DayRange, fundMovements, spendingByCategory, summarizePeriod } from '../../utils/fundPeriod';
import { cardStyle, formatVnd, smallButton } from './shared';

// Income and spending of the fund over a period: headline numbers, money in/out per day
// (or month), the balance over time, spending by category, and the same data as a table.
//
// Chart colours (validated pair, colour-blind safe): money in = blue above the baseline,
// money out = red below it. Text always stays in ink colours.

const INCOME = '#2a78d6';
const EXPENSE = '#e34948';
const INK = '#0f172a';
const INK_2 = '#52514e';
const MUTED = '#898781';
const GRID = '#e1e0d9';
const BASELINE = '#c3c2b7';
const SURFACE = '#ffffff';

// 1500000 → "1,5 tr", 250000 → "250k"
const compactVnd = (n: number): string => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3)}k`;
  return `${sign}${abs}`;
};

// A round step (1, 2 or 5 × 10^n) giving about `count` ticks up to `max`
const niceStep = (max: number, count: number): number => {
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
};

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

// Bar path with a 4px rounded data end and a square end on the baseline
function barPath(x: number, width: number, baseline: number, end: number): string {
  const height = Math.abs(end - baseline);
  if (height < 0.5) return '';
  const r = Math.min(4, width / 2, height);
  if (end < baseline) {
    return `M${x},${baseline} V${end + r} Q${x},${end} ${x + r},${end} H${x + width - r} Q${x + width},${end} ${x + width},${end + r} V${baseline} Z`;
  }
  return `M${x},${baseline} V${end - r} Q${x},${end} ${x + r},${end} H${x + width - r} Q${x + width},${end} ${x + width},${end - r} V${baseline} Z`;
}

const Tooltip: React.FC<{ x: number; width: number; children: React.ReactNode }> = ({ x, width, children }) => (
  <div
    role="status"
    style={{
      position: 'absolute',
      top: 4,
      left: Math.min(Math.max(x - 90, 0), Math.max(0, width - 180)),
      width: 180,
      background: SURFACE,
      border: '1px solid rgba(11,11,11,0.10)',
      borderRadius: 10,
      boxShadow: '0 6px 20px rgba(15,23,42,0.14)',
      padding: '8px 10px',
      fontSize: '0.74rem',
      color: INK,
      pointerEvents: 'none',
      zIndex: 2,
    }}
  >
    {children}
  </div>
);

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: INK_2, fontWeight: 600 }}>
    <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
    {label}
  </span>
);

// Money in above the baseline, money out below it, one column pair per bucket
const InOutChart: React.FC<{ buckets: Bucket[] }> = ({ buckets }) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 230;
  const pad = { top: 12, right: 8, bottom: 24, left: 52 };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;

  const maxIn = Math.max(0, ...buckets.map((b) => b.income));
  const maxOut = Math.max(0, ...buckets.map((b) => b.expense));
  const step = niceStep(Math.max(maxIn, maxOut, 1), 3);
  const top = Math.max(step, Math.ceil(maxIn / step) * step);
  const bottom = maxOut > 0 ? Math.ceil(maxOut / step) * step : 0;
  const y = (v: number) => pad.top + ((top - v) / (top + bottom)) * plotH;
  const zero = y(0);
  const ticks: number[] = [];
  for (let v = -bottom; v <= top + 1e-6; v += step) ticks.push(v);

  const band = buckets.length ? plotW / buckets.length : 0;
  const barW = Math.max(2, Math.min(24, band * 0.6));
  const labelEvery = Math.max(1, Math.ceil(buckets.length / Math.max(1, Math.floor(plotW / 34))));
  const hovered = hover !== null ? buckets[hover] : null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Thu và chi theo thời gian" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? BASELINE : GRID} strokeWidth={1} />
              <text x={pad.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={MUTED} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {t === 0 ? '0' : compactVnd(t)}
              </text>
            </g>
          ))}
          {buckets.map((b, i) => {
            const cx = pad.left + band * i + band / 2;
            return (
              <g key={b.key}>
                {hover === i && <rect x={pad.left + band * i} y={pad.top} width={band} height={plotH} fill="#f1f5f9" />}
                <path d={barPath(cx - barW / 2, barW, zero, y(b.income))} fill={INCOME} />
                <path d={barPath(cx - barW / 2, barW, zero, y(-b.expense))} fill={EXPENSE} />
                {i % labelEvery === 0 && (
                  <text x={cx} y={height - 8} textAnchor="middle" fontSize={10} fill={MUTED}>{b.label}</text>
                )}
                {/* Hit target: the whole column, wider than the bars */}
                <rect
                  x={pad.left + band * i}
                  y={pad.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onClick={() => setHover(i)}
                />
              </g>
            );
          })}
        </svg>
      )}
      {hovered && (
        <Tooltip x={pad.left + band * (hover as number) + band / 2} width={width}>
          <div style={{ fontWeight: 800, marginBottom: 4, textTransform: 'capitalize' }}>{hovered.title}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <LegendItem color={INCOME} label="Thu" /><strong>{formatVnd(hovered.income)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <LegendItem color={EXPENSE} label="Chi" /><strong>{formatVnd(hovered.expense)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid #eef2f4', marginTop: 4, paddingTop: 4, color: INK_2 }}>
            <span>Tồn quỹ</span><strong style={{ color: INK }}>{formatVnd(hovered.balance)}</strong>
          </div>
        </Tooltip>
      )}
    </div>
  );
};

// The balance at the end of each bucket (its own chart: a different measure from in/out)
const BalanceChart: React.FC<{ buckets: Bucket[]; opening: number }> = ({ buckets, opening }) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 150;
  const pad = { top: 14, right: 70, bottom: 22, left: 52 };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;

  const values = [opening, ...buckets.map((b) => b.balance)];
  const min = Math.min(0, ...values);
  const max = Math.max(...values, 1);
  const step = niceStep(max - min || 1, 3);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const y = (v: number) => pad.top + ((hi - v) / (hi - lo || 1)) * plotH;
  const x = (i: number) => pad.left + (buckets.length > 1 ? (plotW * i) / (buckets.length - 1) : plotW / 2);
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-6; v += step) ticks.push(v);
  const path = buckets.map((b, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(b.balance)}`).join(' ');
  const last = buckets[buckets.length - 1];
  const labelEvery = Math.max(1, Math.ceil(buckets.length / Math.max(1, Math.floor(plotW / 34))));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {width > 0 && buckets.length > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Tồn quỹ theo thời gian"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const i = Math.round(((e.clientX - box.left - pad.left) / (plotW || 1)) * (buckets.length - 1));
            setHover(Math.max(0, Math.min(buckets.length - 1, i)));
          }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={pad.left + plotW} y1={y(t)} y2={y(t)} stroke={t === 0 ? BASELINE : GRID} />
              <text x={pad.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={MUTED}>{t === 0 ? '0' : compactVnd(t)}</text>
            </g>
          ))}
          {buckets.map((b, i) => i % labelEvery === 0 && (
            <text key={b.key} x={x(i)} y={height - 6} textAnchor="middle" fontSize={10} fill={MUTED}>{b.label}</text>
          ))}
          <path d={path} fill="none" stroke={INCOME} strokeWidth={2} strokeLinejoin="round" />
          {hover !== null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + plotH} stroke={BASELINE} strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={y(buckets[hover].balance)} r={4.5} fill={INCOME} stroke={SURFACE} strokeWidth={2} />
            </>
          )}
          {/* Direct label on the end point only */}
          {last && (
            <>
              <circle cx={x(buckets.length - 1)} cy={y(last.balance)} r={4} fill={INCOME} stroke={SURFACE} strokeWidth={2} />
              <text x={x(buckets.length - 1) + 8} y={y(last.balance)} dy="0.32em" fontSize={11} fontWeight={700} fill={INK}>
                {compactVnd(last.balance)}
              </text>
            </>
          )}
        </svg>
      )}
      {hover !== null && buckets[hover] && (
        <Tooltip x={x(hover)} width={width}>
          <div style={{ fontWeight: 800, textTransform: 'capitalize' }}>{buckets[hover].title}</div>
          <div>Tồn quỹ: <strong>{formatVnd(buckets[hover].balance)}</strong></div>
        </Tooltip>
      )}
    </div>
  );
};

const StatTile: React.FC<{ label: string; value: number; tone?: string; sub?: string }> = ({ label, value, tone = INK, sub }) => (
  <div style={{ ...cardStyle, padding: 12 }}>
    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>{label}</div>
    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: tone }}>{formatVnd(value)}</div>
    {sub && <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{sub}</div>}
  </div>
);

export const FundReport: React.FC<{
  fund: FundOverview;
  playerById: Map<string, Player>;
  range: DayRange;
  onExport: () => void;
  exporting: boolean;
}> = ({ fund, playerById, range, onExport, exporting }) => {
  const movements = useMemo(() => fundMovements(fund, playerById), [fund, playerById]);
  const summary = useMemo(() => summarizePeriod(fund, movements, range), [fund, movements, range]);
  const buckets = useMemo(() => bucketize(summary, range), [summary, range]);
  const categories = useMemo(() => spendingByCategory(summary.movements), [summary]);
  const byMonth = buckets.length > 0 && buckets[0].key.length === 7;
  const active = buckets.filter((b) => b.income || b.expense);
  const net = summary.income - summary.expense;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 900, color: INK }}>Báo cáo thu chi {range.label}</div>
        <button type="button" onClick={onExport} disabled={exporting} style={{ ...smallButton('#ffffff', '#047857'), border: '1.5px solid #10b981', padding: '7px 12px' }}>
          <Download size={14} /> {exporting ? 'Đang xuất...' : 'Xuất Excel kỳ này'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <StatTile label="Tồn đầu kỳ" value={summary.openingBalance} />
        <StatTile label="Thu trong kỳ" value={summary.income} sub={`${summary.movements.filter((m) => m.kind === 'in').length} khoản`} />
        <StatTile label="Chi trong kỳ" value={summary.expense} sub={`${summary.movements.filter((m) => m.kind === 'out').length} khoản`} />
        <StatTile label="Tồn cuối kỳ" value={summary.closingBalance} sub={`${net >= 0 ? 'Tăng' : 'Giảm'} ${formatVnd(Math.abs(net))}`} />
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
          <div style={{ fontWeight: 800, fontSize: '0.86rem', color: INK }}>Thu chi theo {byMonth ? 'tháng' : 'ngày'}</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <LegendItem color={INCOME} label="Thu (trên trục)" />
            <LegendItem color={EXPENSE} label="Chi (dưới trục)" />
          </div>
        </div>
        {active.length > 0 ? <InOutChart buckets={buckets} /> : (
          <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem' }}>Không có khoản thu chi nào trong kỳ này.</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 800, fontSize: '0.86rem', color: INK, marginBottom: 6 }}>Tồn quỹ cuối mỗi {byMonth ? 'tháng' : 'ngày'}</div>
          <BalanceChart buckets={buckets} opening={summary.openingBalance} />
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 800, fontSize: '0.86rem', color: INK, marginBottom: 10 }}>Chi theo danh mục</div>
          {categories.length === 0 && <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Chưa có khoản chi nào.</div>}
          {categories.map((c) => {
            const share = summary.expense ? Math.round((c.amount / summary.expense) * 100) : 0;
            const widthPct = categories[0].amount ? (c.amount / categories[0].amount) * 100 : 0;
            return (
              <div key={c.value} style={{ marginBottom: 10 }} title={`${c.label}: ${formatVnd(c.amount)} (${c.count} khoản)`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: INK, marginBottom: 3 }}>
                  <span style={{ fontWeight: 700 }}>{c.label} <span style={{ color: MUTED, fontWeight: 500 }}>· {c.count} khoản</span></span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}><strong>{formatVnd(c.amount)}</strong> <span style={{ color: MUTED }}>{share}%</span></span>
                </div>
                <div style={{ height: 10, background: '#f1f5f9', borderRadius: 4 }}>
                  <div style={{ width: `${widthPct}%`, height: '100%', background: EXPENSE, borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* The same numbers as a table */}
      <div style={{ ...cardStyle, overflowX: 'auto' }}>
        <div style={{ fontWeight: 800, fontSize: '0.86rem', color: INK, marginBottom: 6 }}>Chi tiết theo {byMonth ? 'tháng' : 'ngày'}</div>
        {active.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Không có dữ liệu.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr style={{ color: '#64748b', textAlign: 'right' }}>
                <th style={{ padding: 6, textAlign: 'left' }}>{byMonth ? 'Tháng' : 'Ngày'}</th>
                <th style={{ padding: 6 }}>Thu</th>
                <th style={{ padding: 6 }}>Chi</th>
                <th style={{ padding: 6 }}>Tồn quỹ</th>
              </tr>
            </thead>
            <tbody>
              {active.map((b) => (
                <tr key={b.key} style={{ borderTop: '1px solid #f1f5f9', textAlign: 'right' }}>
                  <td style={{ padding: 6, textAlign: 'left', textTransform: 'capitalize', color: INK }}>{b.title}</td>
                  <td style={{ padding: 6, color: INK }}>{b.income ? formatVnd(b.income) : ''}</td>
                  <td style={{ padding: 6, color: INK }}>{b.expense ? formatVnd(b.expense) : ''}</td>
                  <td style={{ padding: 6, fontWeight: 700, color: INK }}>{formatVnd(b.balance)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '1.5px solid #e2e8f0', textAlign: 'right', fontWeight: 800 }}>
                <td style={{ padding: 6, textAlign: 'left' }}>Tổng kỳ</td>
                <td style={{ padding: 6 }}>{formatVnd(summary.income)}</td>
                <td style={{ padding: 6 }}>{formatVnd(summary.expense)}</td>
                <td style={{ padding: 6 }}>{formatVnd(summary.closingBalance)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
