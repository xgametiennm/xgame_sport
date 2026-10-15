import React, { useState, useMemo } from 'react';
import { usePickleball } from '../context/PickleballContext';
import { Player, GameFormat } from '../types/pickleball';
import { getDuprTier } from '../utils/duprCalculator';
import { 
  Users, 
  User, 
  Plus, 
  Search, 
  Flame,
  ChevronRight
} from 'lucide-react';

interface ClubStandingsDesktopProps {
  onOpenRecordMatch: () => void;
  onSelectPlayer?: (player: Player) => void;
}

export const ClubStandingsDesktop: React.FC<ClubStandingsDesktopProps> = ({
  onOpenRecordMatch,
  onSelectPlayer,
}) => {
  const { players, matches, selectedClub } = usePickleball();
  const [format, setFormat] = useState<GameFormat>('doubles');
  const [sortBy, setSortBy] = useState<'rating' | 'wins'>('wins');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filter & sort players
  const sortedPlayers = useMemo(() => {
    let list = players.filter((p) => {
      if (!searchQuery) return true;
      return p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
             (p.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    });

    list.sort((a, b) => {
      const wA = format === 'doubles' ? a.winsDoubles : a.winsSingles;
      const wB = format === 'doubles' ? b.winsDoubles : b.winsSingles;
      const rA = format === 'doubles' ? a.doublesRating : a.singlesRating;
      const rB = format === 'doubles' ? b.doublesRating : b.singlesRating;
      const diffA = a.pointDifferential || 0;
      const diffB = b.pointDifferential || 0;

      if (sortBy === 'wins') {
        return (wB - wA) || (rB - rA) || (diffB - diffA);
      } else {
        return (rB - rA) || (wB - wA) || (diffB - diffA);
      }
    });

    return list;
  }, [players, format, sortBy, searchQuery]);

  const top3 = sortedPlayers.slice(0, 3);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 80px' }}>
      {/* Top Header */}
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
            <span style={{ fontSize: '1.3rem' }}>🏆</span>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Bảng Xếp Hạng Câu Lạc Bộ
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
              DUPR VERIFIED
            </span>
          </div>
          <div style={{ fontSize: '0.88rem', color: '#64748b' }}>
            Hệ thống xếp hạng chuẩn thuật toán DUPR · {selectedClub.name} ({players.length} vận động viên · {matches.length} trận đấu)
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

      {/* 2. PODIUM TOP 3 SHOWCASE (Desktop 3-Column Grid) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 20,
        marginBottom: 28,
      }}>
        {top3.map((player, idx) => {
          const medals = [
            { title: '👑 VUA SÂN ĐẤU #1', bg: 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)', border: '#f59e0b', badgeBg: '#f59e0b', badgeColor: '#fff', cup: '🏆' },
            { title: '⚔️ CHIẾN THẦN BẠC #2', bg: 'linear-gradient(135deg, #f1f5f9 0%, #ffffff 100%)', border: '#94a3b8', badgeBg: '#475569', badgeColor: '#fff', cup: '🥈' },
            { title: '🛡️ HÀO KIỆT ĐỒNG #3', bg: 'linear-gradient(135deg, #ffedd5 0%, #fff7ed 100%)', border: '#d97706', badgeBg: '#b45309', badgeColor: '#fff', cup: '🥉' },
          ];
          const m = medals[idx];

          return (
            <div
              key={player.id}
              onClick={() => onSelectPlayer && onSelectPlayer(player)}
              style={{
                background: m.bg,
                border: `2px solid ${m.border}`,
                borderRadius: 20,
                padding: '24px 20px',
                position: 'relative',
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              {/* Top pill badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{
                  background: m.badgeBg,
                  color: m.badgeColor,
                  fontWeight: 900,
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  borderRadius: 999,
                  textTransform: 'uppercase',
                }}>
                  {m.title}
                </span>
                <span style={{ fontSize: '1.6rem' }}>{m.cup}</span>
              </div>

              {/* Player Avatar & Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img
                  src={player.avatar}
                  alt={player.name}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    border: `3px solid ${m.border}`,
                    objectFit: 'cover',
                    background: '#ffffff',
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(player.name)}`;
                  }}
                />
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', margin: '0 0 2px 0' }}>
                    {player.name}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {player.email}
                  </div>
                </div>
              </div>

              {/* Stats Footer */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                marginTop: 18,
                paddingTop: 16,
                borderTop: '1px solid rgba(0,0,0,0.08)',
              }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                    DUPR {format === 'doubles' ? 'Đôi' : 'Đơn'}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#059669' }}>
                    {(format === 'doubles' ? player.doublesRating : player.singlesRating).toFixed(3)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                    Thắng ({format === 'doubles' ? 'Đôi' : 'Đơn'})
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#b45309' }}>
                    {format === 'doubles' ? player.winsDoubles : player.winsSingles}{' '}
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                      / {format === 'doubles' ? player.matchesPlayedDoubles : player.matchesPlayedSingles} trận
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. CONTROLS BAR (Light theme) */}
      <div className="card" style={{ marginBottom: 20, padding: 18, borderRadius: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          {/* Format Toggle & Sort By */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {/* Format (Doubles vs Singles) */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 999, border: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setFormat('doubles')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 16px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: format === 'doubles' ? '#0d5e46' : 'transparent',
                  color: format === 'doubles' ? '#ffffff' : '#64748b',
                }}
              >
                <Users size={15} />
                <span>Đôi (Doubles 2v2)</span>
              </button>
              <button
                onClick={() => setFormat('singles')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 16px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: format === 'singles' ? '#0d5e46' : 'transparent',
                  color: format === 'singles' ? '#ffffff' : '#64748b',
                }}
              >
                <User size={15} />
                <span>Đơn (Singles 1v1)</span>
              </button>
            </div>

            {/* Sort Criteria */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 999, border: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setSortBy('wins')}
                style={{
                  padding: '7px 16px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: sortBy === 'wins' ? '#f59e0b' : 'transparent',
                  color: sortBy === 'wins' ? '#ffffff' : '#64748b',
                }}
              >
                🏆 Tổng Trận Thắng
              </button>
              <button
                onClick={() => setSortBy('rating')}
                style={{
                  padding: '7px 16px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: sortBy === 'rating' ? '#059669' : 'transparent',
                  color: sortBy === 'rating' ? '#ffffff' : '#64748b',
                }}
              >
                ⭐ Điểm DUPR Cao Nhất
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative', width: 280 }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
            <input
              type="text"
              placeholder="Tìm kiếm vận động viên..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-light"
              style={{ paddingLeft: 36 }}
            />
          </div>
        </div>

        {/* Format Explanation Banner */}
        <div style={{
          marginTop: 14,
          padding: '10px 14px',
          borderRadius: 12,
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          fontSize: '0.82rem',
          color: '#475569',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '1rem' }}>ℹ️</span>
            <span>
              Đang xem bảng xếp hạng: <strong style={{ color: '#064030' }}>{format === 'doubles' ? 'Đôi (Doubles 2v2)' : 'Đơn (Singles 1v1)'}</strong>.
              Các cột <em>Điểm DUPR, Thắng/Tổng, Tỷ Lệ</em> hiển thị riêng theo thể thức này.
            </span>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', fontStyle: 'italic' }}>
            * Cột Chuỗi & Phong độ tính chung các trận gần nhất của VĐV (gồm cả Đơn & Đôi).
          </div>
        </div>
      </div>

      {/* 4. FULL DATA TABLE (Desktop) */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#64748b', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '16px 20px', width: 70, textAlign: 'center' }}>Hạng</th>
              <th style={{ padding: '16px 20px' }}>Vận Động Viên</th>
              <th style={{ padding: '16px 20px' }}>
                Điểm DUPR <span style={{ color: '#059669', fontWeight: 800 }}>({format === 'doubles' ? 'Đôi' : 'Đơn'})</span>
              </th>
              <th style={{ padding: '16px 20px' }}>
                Thắng / Tổng <span style={{ color: '#059669', fontWeight: 800 }}>({format === 'doubles' ? 'Đôi' : 'Đơn'})</span>
              </th>
              <th style={{ padding: '16px 20px' }}>
                Tỷ Lệ Thắng <span style={{ color: '#059669', fontWeight: 800 }}>({format === 'doubles' ? 'Đôi' : 'Đơn'})</span>
              </th>
              <th style={{ padding: '16px 20px' }} title="Chuỗi thắng/thua các trận gần nhất của VĐV (tính cả Đơn & Đôi)">
                Chuỗi <span style={{ fontSize: '0.7rem', textTransform: 'none', color: '#94a3b8' }}>(Gần nhất)</span>
              </th>
              <th style={{ padding: '16px 20px' }} title="Kết quả 5 trận gần nhất (tính cả Đơn & Đôi)">
                Phong Độ (5 trận)
              </th>
              <th style={{ padding: '16px 20px', textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((player, idx) => {
              const rank = idx + 1;
              const wins = format === 'doubles' ? player.winsDoubles : player.winsSingles;
              const totalMatches = format === 'doubles' ? player.matchesPlayedDoubles : player.matchesPlayedSingles;
              const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : '0.0';
              const rating = format === 'doubles' ? player.doublesRating : player.singlesRating;
              const tier = getDuprTier(rating);

              return (
                <tr
                  key={player.id}
                  onClick={() => onSelectPlayer && onSelectPlayer(player)}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                >
                  {/* Rank */}
                  <td style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 900, fontSize: '1rem', color: rank <= 3 ? '#b45309' : '#64748b' }}>
                    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                  </td>

                  {/* Player info */}
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <img
                        src={player.avatar}
                        alt={player.name}
                        style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(player.name)}`;
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>{player.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{player.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* DUPR Rating */}
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontWeight: 900, fontSize: '1.05rem', color: '#059669', fontFamily: 'var(--font-mono)' }}>
                      {rating.toFixed(3)}
                    </span>
                  </td>

                  {/* Matches won */}
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: '#0f172a' }}>
                    <span style={{ color: '#059669' }}>{wins}</span> / <span style={{ color: '#64748b' }}>{totalMatches}</span>
                  </td>

                  {/* Win rate */}
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 64, height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${winRate}%`, height: '100%', background: '#059669', borderRadius: 999 }} />
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{winRate}%</span>
                    </div>
                  </td>

                  {/* Streak */}
                  <td style={{ padding: '14px 20px' }}>
                    {player.streak > 0 ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        background: '#fef2f2',
                        color: '#dc2626',
                        borderRadius: 999,
                        fontSize: '0.75rem',
                        fontWeight: 800,
                      }}>
                        <Flame size={12} /> {player.streak} W
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>—</span>
                    )}
                  </td>

                  {/* Form */}
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(player.form || ['W', 'W', 'W', 'W', 'W']).slice(0, 5).map((f, i) => (
                        <span
                          key={i}
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: f === 'W' ? '#ecfdf5' : '#fef2f2',
                            color: f === 'W' ? '#059669' : '#dc2626',
                            border: `1px solid ${f === 'W' ? '#a7f3d0' : '#fecaca'}`,
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Action */}
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectPlayer) onSelectPlayer(player);
                      }}
                      style={{
                        background: '#f1f5f9',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: '#0f172a',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>Xem</span>
                      <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
