import React, { useState, useMemo } from 'react';
import { usePickleball } from '../context/PickleballContext';
import { Player } from '../types/pickleball';
import { Trophy, TrendingUp, Search } from 'lucide-react';
import { LeaderboardTable, MobilePage, PillToggle } from './MobileUi';
import { MatchDayFilterBar } from './MatchDayFilterBar';
import { formatDayKey, matchesOnDay, selectedDayKey } from '../utils/matchDayFilter';
import { playersWithRecordIn } from '../utils/playerStats';

interface ClubStandingsMobileProps {
  onOpenRecordMatch: () => void;
  onSelectPlayer?: (player: Player) => void;
}

export const ClubStandingsMobile: React.FC<ClubStandingsMobileProps> = ({ onSelectPlayer }) => {
  const { players, matches, matchDayFilter } = usePickleball();
  const [activeFilter, setActiveFilter] = useState<'wins' | 'rating'>('wins');
  const [searchQuery, setSearchQuery] = useState('');

  // With a day picked, only that day's doubles matches count and only those who played are listed
  const dayKey = selectedDayKey(matchDayFilter);
  const dayMatches = useMemo(
    () => matchesOnDay(matches, dayKey).filter((m) => m.format === 'doubles'),
    [matches, dayKey]
  );
  const rankedPlayers = useMemo(
    () => (dayKey ? playersWithRecordIn(players, dayMatches) : players),
    [players, dayMatches, dayKey]
  );

  // Sort players by total wins (winsDoubles) or by DUPR rating with tie-breaker
  const sortedPlayers = useMemo(() => {
    const list = rankedPlayers.filter((p) =>
      !searchQuery.trim() || p.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );
    if (activeFilter === 'wins') {
      return list.sort((a, b) =>
        (b.winsDoubles - a.winsDoubles) ||
        (b.doublesRating - a.doublesRating) ||
        ((b.pointDifferential || 0) - (a.pointDifferential || 0))
      );
    }
    return list.sort((a, b) =>
      (b.doublesRating - a.doublesRating) ||
      (b.winsDoubles - a.winsDoubles) ||
      ((b.pointDifferential || 0) - (a.pointDifferential || 0))
    );
  }, [rankedPlayers, activeFilter, searchQuery]);

  return (
    <MobilePage>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap', margin: 0 }}>
            Bảng xếp hạng (Đôi)
          </h1>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
            {dayKey
              ? `Ngày ${formatDayKey(dayKey)} · ${dayMatches.length} trận đôi`
              : 'Thể thức Đôi 2v2 tiêu chuẩn CLB'}
          </div>
        </div>
        <PillToggle
          value={activeFilter}
          onChange={setActiveFilter}
          options={[
            { value: 'wins', label: 'Trận thắng', icon: <Trophy size={13} /> },
            { value: 'rating', label: 'Rating DUPR', icon: <TrendingUp size={13} /> },
          ]}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <MatchDayFilterBar compact />
      </div>

      {/* Search Input for Mobile */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 11 }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm VĐV theo tên..."
          style={{
            width: '100%',
            padding: '8px 12px 8px 34px',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            fontSize: '0.82rem',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <LeaderboardTable players={sortedPlayers} onSelectPlayer={onSelectPlayer} />
    </MobilePage>
  );
};
