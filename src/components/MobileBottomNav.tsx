import React from 'react';
import { usePickleball, AppTab } from '../context/PickleballContext';
import { CalendarDays, Trophy, Home, Play, User } from 'lucide-react';

const NAV_ITEMS: { tab: AppTab; label: string; Icon: typeof Home }[] = [
  { tab: 'matches', label: 'Lịch thi đấu', Icon: CalendarDays },
  { tab: 'standings', label: 'Bảng xếp hạng', Icon: Trophy },
  { tab: 'home', label: 'Trang chủ', Icon: Home },
  { tab: 'play', label: 'Chơi', Icon: Play },
  { tab: 'profile', label: 'Cá nhân', Icon: User },
];

const ACTIVE_COLOR = '#059669';
const IDLE_COLOR = '#64748b';

export const MobileBottomNav: React.FC = () => {
  const { activeTab, setActiveTab, viewMode } = usePickleball();

  if (viewMode !== 'mobile') return null;

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 68,
      background: '#ffffff',
      borderTop: '1px solid #e8eef0',
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      display: 'flex',
      alignItems: 'stretch',
      zIndex: 90,
      boxShadow: '0 -4px 18px rgba(15, 23, 42, 0.06)',
      maxWidth: 580,
      margin: '0 auto',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {NAV_ITEMS.map(({ tab, label, Icon }) => {
        const active = activeTab === tab;
        const color = active ? ACTIVE_COLOR : IDLE_COLOR;
        return (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            aria-current={active ? 'page' : undefined}
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              cursor: 'pointer',
              color,
            }}
          >
            <Icon size={22} color={color} fill={active ? color : 'none'} fillOpacity={active ? 0.18 : 0} />
            <span style={{ fontSize: '0.62rem', fontWeight: active ? 800 : 600, whiteSpace: 'nowrap' }}>
              {label}
            </span>
            <div style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: active ? ACTIVE_COLOR : 'transparent',
            }} />
          </button>
        );
      })}
    </nav>
  );
};
