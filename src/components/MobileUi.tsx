import React from 'react';
import { ChevronDown, ChevronLeft, ChevronUp, Flame, Minus, Snowflake, Trophy } from 'lucide-react';
import { Player } from '../types/pickleball';
import { avatarUrl, doublesWinRate } from '../utils/playerStats';

const GREEN_GRADIENT = 'linear-gradient(135deg, #10b981 0%, #047857 100%)';

const CARD_STYLE: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e8eef0',
  borderRadius: 20,
  boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)',
};

/** Shell shared by these screens on phone and desktop: soft green wash behind a centered column. */
export const MobilePage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ background: 'linear-gradient(180deg, #d9f5e5 0%, #f4faf6 240px, #f4faf6 100%)' }}>
    <div className="app-page" style={{ margin: '0 auto', padding: '16px 14px 24px' }}>
      {children}
    </div>
  </div>
);

export const MobileCard: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
}> = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{ ...CARD_STYLE, padding: 14, ...style }}>
    {children}
  </div>
);

export const ScreenHeader: React.FC<{
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}> = ({ title, onBack, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Quay lại"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#0f172a',
            cursor: 'pointer',
            padding: 4,
            marginLeft: -6,
            display: 'flex',
          }}
        >
          <ChevronLeft size={26} strokeWidth={2.6} />
        </button>
      )}
      <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
        {title}
      </h1>
    </div>
    {right}
  </div>
);

export const Avatar: React.FC<{
  player: Pick<Player, 'name' | 'avatar'>;
  size?: number;
  ring?: string;
}> = ({ player, size = 36, ring = '#e2e8f0' }) => (
  <img
    src={avatarUrl(player)}
    alt={player.name}
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      objectFit: 'cover',
      background: '#e0f2fe',
      border: `2px solid ${ring}`,
      flexShrink: 0,
    }}
  />
);

export interface PillOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface PillToggleProps<T extends string> {
  options: PillOption<T & {}>[];
  value: T;
  onChange: (value: T) => void;
  stretch?: boolean;
}

export function PillToggle<T extends string>({ options, value, onChange, stretch }: PillToggleProps<T>) {
  return (
    <div style={{
      display: 'flex',
      background: '#eef2f4',
      padding: 3,
      borderRadius: 999,
      width: stretch ? '100%' : undefined,
    }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flex: stretch ? 1 : undefined,
              border: 'none',
              borderRadius: 999,
              padding: '7px 9px',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
              background: active ? GREEN_GRADIENT : 'transparent',
              color: active ? '#ffffff' : '#64748b',
              boxShadow: active ? '0 3px 8px rgba(5, 150, 105, 0.3)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ style, children, ...rest }) => (
  <button
    {...rest}
    style={{
      width: '100%',
      border: 'none',
      borderRadius: 999,
      padding: '14px 18px',
      background: GREEN_GRADIENT,
      color: '#ffffff',
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: '1.02rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      cursor: rest.disabled ? 'not-allowed' : 'pointer',
      opacity: rest.disabled ? 0.5 : 1,
      boxShadow: '0 8px 20px rgba(5, 150, 105, 0.3)',
      ...style,
    }}
  >
    {children}
  </button>
);

const RANK_MEDAL: Record<number, string> = { 1: '#f59e0b', 2: '#94a3b8', 3: '#c2703d' };

const winRateColor = (rate: number): string =>
  rate >= 60 ? '#16a34a' : rate >= 45 ? '#ea580c' : '#dc2626';

const LEADERBOARD_COLUMNS = '22px minmax(0, 1fr) 44px 32px 36px 32px 12px';

const HEADER_CELL: React.CSSProperties = {
  fontSize: '0.6rem',
  lineHeight: 1.2,
  fontWeight: 700,
  color: '#94a3b8',
  textAlign: 'center',
};

/** Ranked member table used on the home dashboard and the standings screen. */
export const LeaderboardTable: React.FC<{
  players: Player[];
  onSelectPlayer?: (player: Player) => void;
}> = ({ players, onSelectPlayer }) => (
  <MobileCard style={{ padding: '6px 8px' }}>
    <div style={{
      display: 'grid',
      gridTemplateColumns: LEADERBOARD_COLUMNS,
      alignItems: 'center',
      gap: 4,
      padding: '8px 2px',
      borderBottom: '1px solid #eef2f4',
    }}>
      <span style={HEADER_CELL}>#</span>
      <span style={{ ...HEADER_CELL, textAlign: 'left' }}>Thành viên</span>
      <span style={HEADER_CELL}>Tổng thắng</span>
      <span style={HEADER_CELL}>Chuỗi</span>
      <span style={HEADER_CELL}>% Thắng</span>
      <span style={HEADER_CELL}>DUPR</span>
      <span />
    </div>

    {players.map((player, index) => {
      const rank = index + 1;
      const rate = doublesWinRate(player);
      const delta = player.rankDelta || 0;

      return (
        <div
          key={player.id}
          onClick={() => onSelectPlayer?.(player)}
          style={{
            display: 'grid',
            gridTemplateColumns: LEADERBOARD_COLUMNS,
            alignItems: 'center',
            gap: 4,
            padding: '7px 2px',
            borderBottom: rank === players.length ? 'none' : '1px solid #f4f6f8',
            background: rank === 1 ? 'linear-gradient(90deg, #f0fdf4, transparent)' : 'transparent',
            cursor: onSelectPlayer ? 'pointer' : 'default',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {rank <= 3 ? (
              <span style={{
                width: 22,
                height: 22,
                borderRadius: 7,
                background: RANK_MEDAL[rank],
                color: '#ffffff',
                fontSize: '0.74rem',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {rank}
              </span>
            ) : (
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>{rank}</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <Avatar player={player} size={28} />
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#0f172a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {player.name}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <Trophy size={12} color="#f59e0b" fill="#fbbf24" />
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>{player.winsDoubles}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            {player.streak >= 2 && (
              <>
                <Flame size={13} color="#f97316" fill="#fb923c" />
                <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#dc2626' }}>{player.streak}</span>
              </>
            )}
            {player.streak <= -2 && (
              <>
                <Snowflake size={13} color="#38bdf8" />
                <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0284c7' }}>{-player.streak}</span>
              </>
            )}
          </div>

          <span style={{ fontSize: '0.78rem', fontWeight: 800, textAlign: 'center', color: winRateColor(rate) }}>
            {rate}%
          </span>

          <span className="mono" style={{ fontSize: '0.68rem', fontWeight: 600, textAlign: 'center', color: '#475569' }}>
            {player.doublesRating.toFixed(2)}
          </span>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {delta > 0 ? (
              <ChevronUp size={15} color="#16a34a" strokeWidth={3} />
            ) : delta < 0 ? (
              <ChevronDown size={15} color="#dc2626" strokeWidth={3} />
            ) : (
              <Minus size={13} color="#cbd5e1" strokeWidth={3} />
            )}
          </div>
        </div>
      );
    })}
  </MobileCard>
);
