import React, { useState, useMemo, useEffect } from 'react';
import { usePickleball } from '../context/PickleballContext';
import { Player, LiveCourtState } from '../types/pickleball';
import { api } from '../services/api';
import { Settings, BarChart3, Trophy, ChevronRight, ChevronDown, Handshake, Check, Plus, Star } from 'lucide-react';
import { Avatar, LeaderboardTable, MobileCard, MobilePage, PillToggle } from './MobileUi';

interface HomeDashboardMobileProps {
  onOpenRecordMatch: () => void;
  onOpenSettings: () => void;
  onSelectPlayer: (player: Player) => void;
  onOpenPlayMenu: () => void;
  onCreateClub: () => void;
  onJoinClub: () => void;
}

const shortName = (name: string) => name.split(' ').slice(-1)[0];

const AwardCard: React.FC<{
  emoji: string;
  title: string;
  subtitle: string;
  tint: string;
  border: string;
  valueColor: string;
  value: string;
  children: React.ReactNode;
}> = ({ emoji, title, subtitle, tint, border, valueColor, value, children }) => (
  <div style={{
    background: tint,
    border: `1px solid ${border}`,
    borderRadius: 18,
    padding: '12px 6px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minWidth: 0,
  }}>
    <div>
      <div style={{ fontSize: '1.7rem', lineHeight: 1.1 }}>{emoji}</div>
      <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0f172a', marginTop: 4 }}>{title}</div>
      <div style={{ fontSize: '0.62rem', color: '#64748b', marginTop: 2, minHeight: 28, lineHeight: 1.3 }}>
        {subtitle}
      </div>
    </div>
    <div style={{ marginTop: 10 }}>
      {children}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 900,
        fontSize: '0.8rem',
        color: valueColor,
        marginTop: 6,
        whiteSpace: 'nowrap',
      }}>
        {value}
      </div>
    </div>
  </div>
);

const AwardName: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#334155',
    marginTop: 4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }}>
    {children}
  </div>
);

export const HomeDashboardMobile: React.FC<HomeDashboardMobileProps> = ({ onSelectPlayer, onCreateClub, onJoinClub }) => {
  const { players, matches, clubs, selectedClub, setSelectedClub, defaultClubId, setDefaultClub, setActiveTab } = usePickleball();
  const [rankingMode, setRankingMode] = useState<'wins' | 'friendly'>('wins');
  const [showClubSheet, setShowClubSheet] = useState(false);
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

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    const lastMonth = curMonth === 0 ? 11 : curMonth - 1;
    const lastYear = curMonth === 0 ? curYear - 1 : curYear;

    let thisMonthCount = 0;
    let lastMonthCount = 0;

    matches.forEach((m) => {
      if (!m.date) return;
      const d = new Date(m.date);
      if (isNaN(d.getTime())) return;
      if (d.getMonth() === curMonth && d.getFullYear() === curYear) {
        thisMonthCount++;
      } else if (d.getMonth() === lastMonth && d.getFullYear() === lastYear) {
        lastMonthCount++;
      }
    });

    return {
      thisMonthCount,
      lastMonthCount,
      diff: thisMonthCount - lastMonthCount,
    };
  }, [matches]);

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      if (rankingMode === 'wins') {
        return (b.winsDoubles - a.winsDoubles) || (b.doublesRating - a.doublesRating) || ((b.pointDifferential || 0) - (a.pointDifferential || 0));
      }
      return (b.doublesRating - a.doublesRating) || (b.winsDoubles - a.winsDoubles) || ((b.pointDifferential || 0) - (a.pointDifferential || 0));
    });
  }, [players, rankingMode]);

  // Top performers
  const ironMan = [...players].sort((a, b) => (b.matchesPlayedDoubles - a.matchesPlayedDoubles) || (b.winsDoubles - a.winsDoubles))[0];
  const hotStreakPlayer = [...players].sort((a, b) => (b.streak - a.streak) || (b.winsDoubles - a.winsDoubles))[0];

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

  return (
    <MobilePage>
      {/* 1. CLUB HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <button
          onClick={() => setShowClubSheet(true)}
          title="Chọn hoặc tạo CLB"
          style={{ minWidth: 0, background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
        >
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#059669', letterSpacing: '0.1em' }}>CLB</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <h1 style={{
              fontSize: '1.3rem',
              fontWeight: 900,
              color: '#064030',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {selectedClub.name.replace('CLB ', '')}
            </h1>
            <ChevronDown size={20} color="#064030" strokeWidth={2.6} style={{ flexShrink: 0 }} />
          </div>
        </button>
        <button
          onClick={() => setActiveTab('clubSettings')}
          title="Cài đặt CLB"
          aria-label="Cài đặt CLB"
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Settings size={18} />
        </button>
      </div>

      {/* 1.5. LIVE MATCHES BANNER MOBILE */}
      {liveCourts.length > 0 && (
        <div style={{
          marginBottom: 14,
          padding: '12px 14px',
          borderRadius: 16,
          background: 'linear-gradient(135deg, #064030, #047857)',
          border: '1.5px solid #059669',
          color: '#ffffff',
          boxShadow: '0 4px 16px rgba(6, 64, 48, 0.25)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: '#e11d48',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: '0.68rem',
              fontWeight: 900,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffffff' }} />
              TRỰC TIẾP TRÊN SÂN
            </span>
            <button
              onClick={() => setActiveTab('scoreboard')}
              style={{
                background: '#bef264',
                color: '#064030',
                border: 'none',
                padding: '3px 8px',
                borderRadius: 999,
                fontSize: '0.68rem',
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              Xem ngay ➔
            </button>
          </div>
          {liveCourts.slice(0, 2).map((c) => (
            <div
              key={c.id}
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.set('tab', 'scoreboard');
                url.searchParams.set('court', c.id);
                url.searchParams.set('mode', 'spectator');
                window.history.replaceState(null, '', url);
                setActiveTab('scoreboard');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
              }}
            >
              <div>
                <div style={{ fontSize: '0.7rem', color: '#a7f3d0', fontWeight: 800 }}>{c.courtName}</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 800 }}>
                  {c.t1Right?.name?.split(' ').slice(-1) || 'Đ1'}/{c.t1Left?.name?.split(' ').slice(-1) || 'Đ1'} vs {c.t2Right?.name?.split(' ').slice(-1) || 'Đ2'}/{c.t2Left?.name?.split(' ').slice(-1) || 'Đ2'}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 900, color: '#bef264' }}>
                {c.score1} - {c.score2}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. HERO STATS CARD */}
      <MobileCard
        onClick={() => setActiveTab('matches')}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, marginBottom: 20, cursor: 'pointer' }}
      >
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 16,
          background: 'linear-gradient(135deg, #10b981, #047857)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 16px rgba(16, 185, 129, 0.3)',
          fontSize: '1.7rem',
          flexShrink: 0,
        }}>
          🏓
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>Tổng số trận đấu</div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.32rem',
            fontWeight: 900,
            color: '#064030',
            lineHeight: 1.15,
            whiteSpace: 'nowrap',
          }}>
            {selectedClub.matchCount} trận
          </div>
        </div>

        <div style={{ borderLeft: '1px solid #e8eef0', paddingLeft: 10, display: selectedClub.matchCount > 0 ? 'flex' : 'none', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            background: monthlyStats.diff < 0 ? '#fef2f2' : '#ecfdf5',
            color: monthlyStats.diff < 0 ? '#ef4444' : '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <BarChart3 size={17} />
          </div>
          <div>
            {monthlyStats.lastMonthCount > 0 ? (
              <>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  color: monthlyStats.diff < 0 ? '#ef4444' : '#059669',
                }}>
                  {monthlyStats.diff >= 0 ? `+${monthlyStats.diff}` : monthlyStats.diff} trận
                </div>
                <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  so với tháng trước
                </div>
              </>
            ) : monthlyStats.thisMonthCount > 0 ? (
              <>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  color: '#059669',
                }}>
                  {monthlyStats.thisMonthCount} trận
                </div>
                <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  trong tháng này
                </div>
              </>
            ) : (
              <>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  color: '#059669',
                }}>
                  {selectedClub.courtsCount || 4} sân
                </div>
                <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  sân hoạt động
                </div>
              </>
            )}
          </div>
        </div>
      </MobileCard>

      {/* 2.5 QUICK ACCESS TO TOURNAMENT */}
      <MobileCard
        onClick={() => setActiveTab('tournament')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          marginBottom: 18,
          background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
          color: '#ffffff',
          borderRadius: 16,
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(4, 120, 87, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.6rem' }}>🏆</span>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#ffffff' }}>
              Giải Đấu CLB & Bốc Thăm Random
            </div>
            <div style={{ fontSize: '0.7rem', color: '#a7f3d0' }}>
              Vòng bảng, nhánh đấu loại trực tiếp & quay số ngẫu nhiên
            </div>
          </div>
        </div>
        <ChevronRight size={18} color="#bef264" />
      </MobileCard>

      {/* 2.6 QUICK ACCESS TO CLUB FUND */}
      <MobileCard
        onClick={() => setActiveTab('fund')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          marginBottom: 18,
          borderRadius: 16,
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.6rem' }}>💰</span>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0f172a' }}>Quỹ CLB</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Tổng quỹ, các đợt thu, chi tiêu & hóa đơn</div>
          </div>
        </div>
        <ChevronRight size={18} color="#059669" />
      </MobileCard>

      {/* 3. SEASON AWARDS */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>Danh hiệu mùa giải</h2>
        <button
          onClick={() => setActiveTab('standings')}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '0.76rem',
            fontWeight: 600,
            color: '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <span>Xem tất cả</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {ironMan && hotStreakPlayer && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 22 }}>
          <AwardCard
            emoji="⚡"
            title="Chiến Thần"
            subtitle="Ra sân nhiều trận nhất"
            tint="#fff8ed"
            border="#fde9c8"
            valueColor="#ea580c"
            value={`${ironMan.matchesPlayedDoubles} trận`}
          >
            <Avatar player={ironMan} size={36} ring="#ffffff" />
            <AwardName>{ironMan.name}</AwardName>
          </AwardCard>

          <AwardCard
            emoji="💎"
            title="Song Kiếm"
            subtitle="Cặp bài trùng ăn ý nhất"
            tint="#f0fdf4"
            border="#c9f0d6"
            valueColor="#059669"
            value={bestDuo ? `${bestDuo.winRate}% (${bestDuo.wins}/${bestDuo.played}T)` : '—'}
          >
            {bestDuo ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Avatar player={bestDuo.p1} size={32} ring="#ffffff" />
                  <div style={{ marginLeft: -8, display: 'flex' }}>
                    <Avatar player={bestDuo.p2} size={32} ring="#ffffff" />
                  </div>
                </div>
                <AwardName>{shortName(bestDuo.p1.name)} & {shortName(bestDuo.p2.name)}</AwardName>
              </>
            ) : (
              <AwardName>Chưa có dữ liệu</AwardName>
            )}
          </AwardCard>

          <AwardCard
            emoji="🔥"
            title="Huỷ Diệt"
            subtitle="Chuỗi bất bại dài nhất"
            tint="#fff1f1"
            border="#fcd9d9"
            valueColor="#dc2626"
            value={`${Math.max(0, hotStreakPlayer.streak)} trận liên tiếp`}
          >
            <Avatar player={hotStreakPlayer} size={36} ring="#ffffff" />
            <AwardName>{hotStreakPlayer.name}</AwardName>
          </AwardCard>
        </div>
      )}

      {/* 4. LEADERBOARD */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap' }}>Bảng xếp hạng</h2>
        <PillToggle
          value={rankingMode}
          onChange={setRankingMode}
          options={[
            { value: 'wins', label: 'Tổng trận thắng', icon: <Trophy size={13} /> },
            { value: 'friendly', label: 'Giao Hữu', icon: <Handshake size={13} /> },
          ]}
        />
      </div>

      <LeaderboardTable players={sortedPlayers.slice(0, 10)} onSelectPlayer={onSelectPlayer} />

      {/* Club switcher sheet */}
      {showClubSheet && (
        <div className="modal-overlay" onClick={() => setShowClubSheet(false)} style={{ alignItems: 'flex-end', padding: 0 }}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 580,
              maxHeight: '70vh',
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              padding: '18px 16px 28px',
            }}
          >
            <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>Câu lạc bộ của bạn</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {clubs.map((c) => {
                const active = c.id === selectedClub.id;
                const isDefault = c.id === defaultClubId;

                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedClub(c);
                      setShowClubSheet(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 14,
                      border: active ? '1.5px solid #10b981' : '1px solid #eef2f4',
                      background: active ? '#f0fdf4' : '#ffffff',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: '1.4rem' }}>{c.id.includes('badminton') ? '🏸' : '🏓'}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>{c.name}</span>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>{c.location}</span>
                    </span>

                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isDefault ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            background: '#fef3c7',
                            color: '#b45309',
                            padding: '2px 8px',
                            borderRadius: 999,
                            fontSize: '0.66rem',
                            fontWeight: 800,
                          }}
                        >
                          <Star size={11} fill="#b45309" color="#b45309" />
                          <span>Mặc định</span>
                        </span>
                      ) : (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setDefaultClub(c.id);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            padding: '3px 8px',
                            borderRadius: 999,
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            color: '#64748b',
                            background: '#f1f5f9',
                            cursor: 'pointer',
                          }}
                        >
                          <Star size={11} color="#f59e0b" />
                          <span>Đặt mặc định</span>
                        </span>
                      )}

                      {active && <Check size={18} color="#059669" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
              <button
                onClick={() => {
                  setShowClubSheet(false);
                  onCreateClub();
                }}
                style={{
                  marginTop: 4,
                  padding: '12px',
                  borderRadius: 14,
                  border: '1.5px dashed #10b981',
                  background: '#ffffff',
                  color: '#047857',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <Plus size={18} strokeWidth={3} />
                <span>Tạo CLB mới</span>
              </button>
              <button
                onClick={() => {
                  setShowClubSheet(false);
                  onJoinClub();
                }}
                style={{
                  padding: '12px',
                  borderRadius: 14,
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Tham gia CLB bằng mã
              </button>
            </div>
          </div>
        </div>
      )}
    </MobilePage>
  );
};
