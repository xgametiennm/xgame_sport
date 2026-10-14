import React, { useState, useMemo, useEffect } from 'react';
import { usePickleball } from '../context/PickleballContext';
import { Player, LiveCourtState } from '../types/pickleball';
import { api } from '../services/api';
import { 
  MapPin,
  Plus,
  ChevronRight,
  Eye,
  Radio
} from 'lucide-react';

interface HomeDashboardDesktopProps {
  onOpenRecordMatch: () => void;
  onOpenSettings: () => void;
  onSelectPlayer: (player: Player) => void;
  onOpenPlayMenu: () => void;
  onCreateClub: () => void;
  onJoinClub: () => void;
}

export const HomeDashboardDesktop: React.FC<HomeDashboardDesktopProps> = ({
  onOpenRecordMatch,
  onSelectPlayer,
}) => {
  const { players, matches, selectedClub, setActiveTab } = usePickleball();
  const [rankingMode, setRankingMode] = useState<'wins' | 'points'>('wins');
  const [liveCourts, setLiveCourts] = useState<LiveCourtState[]>([]);

  useEffect(() => {
    let timer: any = null;
    const fetchLive = async () => {
      try {
        const courts = await api.getLiveCourts(selectedClub.id);
        if (Array.isArray(courts)) setLiveCourts(courts);
      } catch {}
    };
    fetchLive();
    timer = setInterval(fetchLive, 4000);
    return () => clearInterval(timer);
  }, [selectedClub.id]);

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      if (rankingMode === 'wins') {
        return (b.winsDoubles - a.winsDoubles) || (b.doublesRating - a.doublesRating) || ((b.pointDifferential || 0) - (a.pointDifferential || 0));
      }
      return (b.doublesRating - a.doublesRating) || (b.winsDoubles - a.winsDoubles) || ((b.pointDifferential || 0) - (a.pointDifferential || 0));
    });
  }, [players, rankingMode]);

  const bestDuo = useMemo(() => {
    const duoMap = new Map<string, { p1: Player; p2: Player; played: number; wins: number }>();
    matches.forEach((m) => {
      if (m.format !== 'doubles') return;
      const checkTeam = (t: { player1?: Player; player2?: Player }, teamNum: 1 | 2) => {
        if (t.player1 && t.player2) {
          const idA = t.player1.id;
          const idB = t.player2.id;
          const key = idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
          const existing = duoMap.get(key) || {
            p1: idA < idB ? t.player1 : t.player2,
            p2: idA < idB ? t.player2 : t.player1,
            played: 0,
            wins: 0,
          };
          existing.played++;
          if (m.winner === teamNum) existing.wins++;
          duoMap.set(key, existing);
        }
      };
      checkTeam(m.team1, 1);
      checkTeam(m.team2, 2);
    });
    const list = Array.from(duoMap.values()).map((d) => ({
      ...d,
      winRate: Math.round((d.wins / d.played) * 100),
    }));
    if (list.length === 0) return null;
    const qualified = list.filter((d) => d.played >= 2);
    const pool = qualified.length > 0 ? qualified : list;
    pool.sort((a, b) => (b.wins - a.wins) || (b.winRate - a.winRate) || (b.played - a.played));
    return pool[0];
  }, [matches]);

  const ironMan = [...players].sort((a, b) => (b.matchesPlayedDoubles - a.matchesPlayedDoubles) || (b.winsDoubles - a.winsDoubles))[0] || players[0];
  const hotStreakPlayer = [...players].sort((a, b) => (b.streak - a.streak) || (b.winsDoubles - a.winsDoubles))[0] || players[0];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 80px' }}>
      {/* Top Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: '1px solid #e2e8f0',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: '1.3rem' }}>🏓</span>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#064030', margin: 0 }}>
              {selectedClub.name}
            </h1>
            <span style={{
              background: '#ecfdf5',
              color: '#059669',
              fontSize: '0.75rem',
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: 999,
              border: '1px solid #a7f3d0',
            }}>
              DUPR CLUB
            </span>
          </div>
          <div style={{ fontSize: '0.88rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={14} color="#059669" /> {selectedClub.location}
            </span>
            <span>•</span>
            <span><strong>{players.length}</strong> thành viên</span>
            <span>•</span>
            <span><strong>{selectedClub.matchCount}</strong> trận đấu</span>
            <span>•</span>
            <span><strong>{selectedClub.courtsCount}</strong> sân đấu</span>
          </div>
        </div>

        <button
          onClick={onOpenRecordMatch}
          className="btn-primary"
          style={{
            padding: '10px 20px',
            fontSize: '0.9rem',
            borderRadius: 12,
            gap: 8,
          }}
        >
          <Plus size={18} strokeWidth={2.5} />
          <span>Ghi Trận Đấu Mới</span>
        </button>
      </div>

      {/* 1.5. LIVE MATCHES BANNER (If any match is playing on courts right now) */}
      {liveCourts.length > 0 && (
        <div style={{
          marginBottom: 24,
          padding: '16px 20px',
          borderRadius: 20,
          background: 'linear-gradient(135deg, #064030, #065f46)',
          border: '1.5px solid #059669',
          color: '#ffffff',
          boxShadow: '0 8px 24px rgba(6, 64, 48, 0.25)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#e11d48',
                color: '#ffffff',
                padding: '3px 9px',
                borderRadius: 999,
                fontSize: '0.72rem',
                fontWeight: 900,
                letterSpacing: '0.04em',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ffffff', animation: 'pulse 1.2s infinite' }} />
                TRỰC TIẾP TRÊN SÂN (LIVE)
              </span>
              <span style={{ fontSize: '0.86rem', color: '#a7f3d0', fontWeight: 700 }}>
                {liveCourts.length} trận đang tranh tài thời gian thực
              </span>
            </div>

            <button
              onClick={() => setActiveTab('scoreboard')}
              className="btn-court"
              style={{ padding: '5px 12px', fontSize: '0.78rem', borderRadius: 999 }}
            >
              Mở Tất Cả Bảng Điểm ➔
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {liveCourts.map((court) => (
              <div
                key={court.id}
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('tab', 'scoreboard');
                  url.searchParams.set('court', court.id);
                  url.searchParams.set('mode', 'spectator');
                  window.history.replaceState(null, '', url);
                  setActiveTab('scoreboard');
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 14,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#bef264', fontWeight: 800, textTransform: 'uppercase' }}>
                    {court.courtName || 'Sân đấu'}
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, marginTop: 2, color: '#ffffff' }}>
                    {court.t1Right?.name?.split(' ').slice(-1) || 'Đ1'}/{court.t1Left?.name?.split(' ').slice(-1) || 'Đ1'} vs {court.t2Right?.name?.split(' ').slice(-1) || 'Đ2'}/{court.t2Left?.name?.split(' ').slice(-1) || 'Đ2'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 3 }}>
                    {court.isGameOver ? '🏁 Đã kết thúc' : `🎾 Người phát #${court.serverNumber || 1}`}
                  </div>
                </div>

                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.6rem',
                    fontWeight: 900,
                    color: '#bef264',
                    lineHeight: 1,
                  }}>
                    {court.score1} - {court.score2}
                  </div>
                  <ChevronRight size={18} color="#bef264" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. SEASON HIGHLIGHT CARDS (3 Columns) */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
            Danh hiệu mùa giải 🏆
          </h2>
          <button
            onClick={() => setActiveTab('standings')}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '0.88rem',
              fontWeight: 800,
              color: '#059669',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>Bảng xếp hạng chi tiết</span>
            <ChevronRight size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {/* Card 1: CHIẾN THẦN RA SÂN */}
          <div className="card card-interactive" style={{ padding: '24px 20px', borderRadius: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{
                background: '#ffedd5',
                color: '#c2410c',
                fontWeight: 900,
                fontSize: '0.75rem',
                padding: '4px 10px',
                borderRadius: 999,
              }}>
                ⚡ CHIẾN THẦN RA SÂN
              </span>
              <span style={{ fontSize: '2rem' }}>⚡</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 16 }}>
              Tay vợt cống hiến bền bỉ nhất với số trận kỷ lục
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src={ironMan.avatar}
                alt={ironMan.name}
                style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fdba74' }}
              />
              <div>
                <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#0f172a' }}>{ironMan.name}</div>
                <div style={{ color: '#ea580c', fontWeight: 900, fontSize: '1.15rem' }}>
                  {ironMan.matchesPlayedDoubles} trận đấu
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: SONG KIẾM HỢP BÍCH */}
          <div className="card card-interactive" style={{ padding: '24px 20px', borderRadius: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{
                background: '#ecfdf5',
                color: '#047857',
                fontWeight: 900,
                fontSize: '0.75rem',
                padding: '4px 10px',
                borderRadius: 999,
              }}>
                💎 SONG KIẾM HỢP BÍCH
              </span>
              <span style={{ fontSize: '2rem' }}>💎</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 16 }}>
              Cặp bài trùng ăn ý với tỉ lệ thắng áp đảo nhất
            </div>
            {bestDuo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', position: 'relative' }}>
                  <img
                    src={bestDuo.p1.avatar}
                    alt={bestDuo.p1.name}
                    style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid #a7f3d0' }}
                  />
                  <img
                    src={bestDuo.p2.avatar}
                    alt={bestDuo.p2.name}
                    style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid #a7f3d0', marginLeft: -14 }}
                  />
                </div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#0f172a' }}>
                    {bestDuo.p1.name.split(' ').slice(-1)} & {bestDuo.p2.name.split(' ').slice(-1)}
                  </div>
                  <div style={{ color: '#059669', fontWeight: 900, fontSize: '1.15rem' }}>
                    {bestDuo.winRate}% tỷ lệ thắng
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {bestDuo.wins}/{bestDuo.played} trận thắng
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', padding: '10px 0' }}>
                Chưa đủ trận đánh đôi
              </div>
            )}
          </div>

          {/* Card 3: PHONG ĐỘ HUỶ DIỆT */}
          <div className="card card-interactive" style={{ padding: '24px 20px', borderRadius: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{
                background: '#fef2f2',
                color: '#b91c1c',
                fontWeight: 900,
                fontSize: '0.75rem',
                padding: '4px 10px',
                borderRadius: 999,
              }}>
                🔥 PHONG ĐỘ HUỶ DIỆT
              </span>
              <span style={{ fontSize: '2rem' }}>🔥</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 16 }}>
              Tay vợt sở hữu chuỗi trận bất bại dài nhất CLB
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src={hotStreakPlayer.avatar}
                alt={hotStreakPlayer.name}
                style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fca5a5' }}
              />
              <div>
                <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#0f172a' }}>{hotStreakPlayer.name}</div>
                <div style={{ color: '#dc2626', fontWeight: 900, fontSize: '1.15rem' }}>
                  {hotStreakPlayer.streak} trận liên tiếp
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. TWO COLUMNS: QUICK LEADERBOARD & RECENT MATCHES */}
      <div style={{ display: 'grid', gridTemplateColumns: '65% 35%', gap: 24, alignItems: 'start' }}>
        {/* Left Column: Quick Standings */}
        <div className="card" style={{ padding: '20px 24px', borderRadius: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                Top Bảng Xếp Hạng CLB (Đánh Đôi)
              </h3>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                Thể thức Đôi 2v2 tiêu chuẩn CLB
              </div>
            </div>

            {/* Toggle Switch */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 999 }}>
              <button
                onClick={() => setRankingMode('wins')}
                style={{
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: 999,
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: rankingMode === 'wins' ? '#0d5e46' : 'transparent',
                  color: rankingMode === 'wins' ? '#fff' : '#64748b',
                }}
              >
                Tổng Trận Thắng
              </button>
              <button
                onClick={() => setRankingMode('points')}
                style={{
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: 999,
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: rankingMode === 'points' ? '#0d5e46' : 'transparent',
                  color: rankingMode === 'points' ? '#fff' : '#64748b',
                }}
              >
                Điểm DUPR
              </button>
            </div>
          </div>

          {/* List items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortedPlayers.slice(0, 7).map((player, idx) => {
              const rank = idx + 1;
              return (
                <div
                  key={player.id}
                  onClick={() => onSelectPlayer(player)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 14,
                    background: idx % 2 === 0 ? '#f8fafc' : '#ffffff',
                    border: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateX(4px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateX(0)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 28, textAlign: 'center', fontWeight: 900, fontSize: '1rem', color: rank <= 3 ? '#b45309' : '#94a3b8' }}>
                      {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                    </div>
                    <img
                      src={player.avatar}
                      alt={player.name}
                      style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #e2e8f0' }}
                    />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{player.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>DUPR Đôi: {player.doublesRating.toFixed(3)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 900, color: '#0f172a', fontSize: '1rem' }}>
                        {rankingMode === 'wins' ? `${player.winsDoubles} trận` : player.doublesRating.toFixed(3)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700 }}>
                        {rankingMode === 'wins' ? 'Thắng đôi' : 'Rating DUPR đôi'}
                      </div>
                    </div>
                    <ChevronRight size={16} color="#cbd5e1" />
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setActiveTab('standings')}
            style={{
              width: '100%',
              marginTop: 16,
              padding: '12px',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#0d5e46',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>Xem Đầy Đủ {players.length} Thành Viên Trên Bảng Xếp Hạng</span>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Right Column: Quick Action & Live Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Quick Record Match Card */}
          <div className="card" style={{
            background: 'linear-gradient(135deg, #0d5e46 0%, #064030 100%)',
            color: '#ffffff',
            padding: 24,
            borderRadius: 20,
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, margin: '0 0 8px 0' }}>
              🏓 Ghi Trận Đấu Mới
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', margin: '0 0 16px 0' }}>
              Cập nhật kết quả tức thì. Thuật toán DUPR tự động tính toán lại điểm số cho cả 4 vận động viên.
            </p>
            <button
              onClick={onOpenRecordMatch}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 12,
                background: '#bef264',
                color: '#064030',
                border: 'none',
                fontWeight: 900,
                fontSize: '0.92rem',
                cursor: 'pointer',
              }}
            >
              + Nhập Điểm Trận Đấu
            </button>
          </div>

          {/* Sân Đấu Trực Tiếp Widget */}
          <div className="card" style={{ padding: 20, borderRadius: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                Tình Trạng Sân CLB
              </span>
              <span style={{
                background: liveCourts.length > 0 ? '#fef2f2' : '#ecfdf5',
                color: liveCourts.length > 0 ? '#dc2626' : '#059669',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 999,
              }}>
                {liveCourts.length > 0 
                  ? `${liveCourts.length}/${selectedClub.courtsCount || 4} Sân Đang Đấu` 
                  : `${selectedClub.courtsCount || 4} Sân Hoạt Động`}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 14 }}>
              Hệ thống Courtside Scoreboard kết nối trực tiếp bảng điểm điện tử tại cụm sân.
            </div>
            <button
              onClick={() => setActiveTab('scoreboard')}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#0f172a',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Mở Bảng Điểm Điện Tử Sân Đấu
            </button>
          </div>

          {/* Lịch Sử Trận Đấu CLB Widget */}
          <div className="card" style={{ padding: 20, borderRadius: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                Lịch Sử Trận Đấu CLB
              </span>
              <span style={{
                background: '#eff6ff',
                color: '#2563eb',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 999,
              }}>
                {matches.filter(m => !m.clubId || m.clubId === selectedClub.id).length} Trận
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 14 }}>
              Xem bảng phân tích chi tiết từng set, tỉ lệ chia điểm và biến động DUPR từng trận.
            </div>
            <button
              onClick={() => setActiveTab('matches')}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 10,
                border: '1px solid #bfdbfe',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              Xem Toàn Bộ Lịch Sử Đấu →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
