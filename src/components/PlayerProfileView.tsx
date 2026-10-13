import React, { useState, useMemo } from 'react';
import { Player, MatchImportance, MatchResult } from '../types/pickleball';
import { usePickleball } from '../context/PickleballContext';
import {
  Activity,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Flame,
  Gamepad2,
  Handshake,
  Pencil,
  PieChart,
  Shield,
  Swords,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import { Avatar, MobileCard, MobilePage, PillToggle, ScreenHeader } from './MobileUi';
import { computeRelations, isOnTeam, matchesOfPlayer, playerDisplayId, RelationStat } from '../utils/playerStats';

interface PlayerProfileViewProps {
  player: Player;
  onClose?: () => void;
  onEditProfile?: () => void;
  onSelectPlayer?: (player: Player) => void;
  isModal?: boolean;
}

type ProfileTab = 'headToHead' | 'history' | 'teammates';
type ModeFilter = 'all' | MatchImportance;
type PeriodFilter = 'all' | 'month' | 'year';

const MODE_META: Record<MatchImportance, { label: string; icon: React.ReactNode }> = {
  casual: { label: 'Đấu giao hữu', icon: <Handshake size={15} color="#059669" /> },
  sanctioned: { label: 'Đấu giải', icon: <Trophy size={15} color="#f59e0b" /> },
  league: { label: 'Đấu CLB', icon: <Shield size={15} color="#6366f1" /> },
};

const selectStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  borderRadius: 10,
  padding: '6px 8px',
  fontSize: '0.72rem',
  fontWeight: 600,
  color: '#334155',
  cursor: 'pointer',
  minWidth: 0,
};

const StatTile: React.FC<{ icon: React.ReactNode; tint: string; value: React.ReactNode; label: string }> = ({
  icon,
  tint,
  value,
  label,
}) => (
  <div style={{ background: tint, borderRadius: 14, padding: '10px 8px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
    <div style={{ flexShrink: 0, display: 'flex' }}>{icon}</div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.12rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  </div>
);

const RelationCard: React.FC<{
  emoji: string;
  title: string;
  tint: string;
  border: string;
  stat?: RelationStat;
  good: boolean;
  onSelectPlayer?: (player: Player) => void;
}> = ({ emoji, title, tint, border, stat, good, onSelectPlayer }) => (
  <div style={{ background: tint, border: `1px solid ${border}`, borderRadius: 16, padding: '10px 12px', minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
      <span>{emoji}</span>
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
    </div>
    {stat ? (
      <div
        onClick={() => onSelectPlayer && onSelectPlayer(stat.player)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: onSelectPlayer ? 'pointer' : 'default' }}
        title={onSelectPlayer ? `Xem hồ sơ ${stat.player.name}` : undefined}
      >
        <div style={{ textAlign: 'center', minWidth: 0, flex: 1 }}>
          <Avatar player={stat.player} size={36} ring="#ffffff" />
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#059669', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {stat.player.name}
          </div>
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: '0.62rem', color: '#64748b' }}>Tỉ lệ thắng</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 900, color: good ? '#16a34a' : '#dc2626' }}>
            {stat.winRate}%
          </div>
        </div>
      </div>
    ) : (
      <div style={{ fontSize: '0.72rem', color: '#94a3b8', padding: '10px 0' }}>Chưa có dữ liệu</div>
    )}
  </div>
);

const RelationList: React.FC<{ items: RelationStat[]; emptyText: string; onSelectPlayer?: (player: Player) => void }> = ({
  items,
  emptyText,
  onSelectPlayer,
}) => (
  <div>
    {items.map((item, idx) => (
      <div
        key={item.player.id}
        onClick={() => onSelectPlayer && onSelectPlayer(item.player)}
        style={{
          display: 'grid',
          gridTemplateColumns: '18px auto minmax(0, 1fr) auto 44px',
          alignItems: 'center',
          gap: 8,
          padding: '8px 0',
          borderBottom: idx === items.length - 1 ? 'none' : '1px solid #f4f6f8',
          cursor: onSelectPlayer ? 'pointer' : 'default',
        }}
        title={onSelectPlayer ? `Xem hồ sơ ${item.player.name}` : undefined}
      >
        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#94a3b8', textAlign: 'center' }}>{idx + 1}</span>
        <Avatar player={item.player} size={30} />
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.player.name}
        </span>
        <span style={{ fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap' }}>
          {item.played} trận · {item.wins} thắng
        </span>
        <span style={{ fontSize: '0.84rem', fontWeight: 900, textAlign: 'right', color: item.winRate >= 50 ? '#16a34a' : '#dc2626' }}>
          {item.winRate}%
        </span>
      </div>
    ))}
    {items.length === 0 && (
      <div style={{ padding: 20, textAlign: 'center', fontSize: '0.82rem', color: '#94a3b8' }}>{emptyText}</div>
    )}
  </div>
);

export const PlayerProfileView: React.FC<PlayerProfileViewProps> = ({ player, onClose, onEditProfile, onSelectPlayer }) => {
  const { matches, players, viewMode } = usePickleball();
  const [copiedId, setCopiedId] = useState(false);
  const [tab, setTab] = useState<ProfileTab>('history');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const displayId = playerDisplayId(player);

  const handleCopyId = () => {
    try {
      navigator.clipboard.writeText(displayId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // fallback
    }
  };

  // This player's matches, seen from their side
  const history = useMemo(() => {
    return matchesOfPlayer(matches, player).map((m: MatchResult) => {
      const onTeam1 = isOnTeam(m.team1, player);
      const mine = onTeam1 ? m.team1 : m.team2;
      const theirs = onTeam1 ? m.team2 : m.team1;
      let scoreText = '';
      if (m.sets && m.sets.length > 0) {
        scoreText = m.sets.map((s) => (onTeam1 ? `${s.team1}-${s.team2}` : `${s.team2}-${s.team1}`)).join(', ');
      } else {
        scoreText = onTeam1 ? `${m.totalScoreTeam1}-${m.totalScoreTeam2}` : `${m.totalScoreTeam2}-${m.totalScoreTeam1}`;
      }
      return {
        match: m,
        time: new Date(m.date).getTime(),
        won: onTeam1 ? m.winner === 1 : m.winner === 2,
        scoreText,
        delta: mine.deltaRating,
        opponents: [theirs.player1, theirs.player2].filter((p): p is Player => !!p),
      };
    });
  }, [matches, player]);

  const [now] = useState(() => new Date());

  const filteredHistory = useMemo(() => {
    return history
      .filter((h) => {
        if (modeFilter !== 'all' && h.match.importance !== modeFilter) return false;
        const d = new Date(h.time);
        if (period === 'year') return d.getFullYear() === now.getFullYear();
        if (period === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        return true;
      })
      .sort((a, b) => (sortOrder === 'newest' ? b.time - a.time : a.time - b.time));
  }, [history, modeFilter, period, sortOrder, now]);

  const relations = useMemo(() => computeRelations(matches, player), [matches, player]);
  const byWinRate = (list: RelationStat[]) => [...list].sort((a, b) => b.winRate - a.winRate || b.played - a.played);
  const teammatesByRate = byWinRate(relations.teammates);
  const opponentsByRate = byWinRate(relations.opponents);
  const worst = (list: RelationStat[]) => (list.length > 1 ? list[list.length - 1] : undefined);

  // Overall player stats
  const totalMatches = player.matchesPlayedDoubles + player.matchesPlayedSingles;
  const totalWins = player.winsDoubles + player.winsSingles;
  const totalLosses = Math.max(0, totalMatches - totalWins);
  const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

  const clubRank = [...players]
    .sort((a, b) => (b.winsDoubles - a.winsDoubles) || (b.doublesRating - a.doublesRating) || ((b.pointDifferential || 0) - (a.pointDifferential || 0)))
    .findIndex((p) => p.id === player.id) + 1;
  const topPercent = clubRank > 0 ? Math.max(1, Math.ceil((clubRank / players.length) * 100)) : null;

  const honorBadges = useMemo(() => {
    const list: { label: string; bg: string; color: string; border: string }[] = [];
    if (clubRank === 1) {
      list.push({ label: '👑 Vua Sân Đấu #1', bg: '#fef3c7', color: '#b45309', border: '#fcd34d' });
    } else if (clubRank === 2) {
      list.push({ label: '⚔️ Chiến Thần Bạc #2', bg: '#f1f5f9', color: '#334155', border: '#cbd5e1' });
    } else if (clubRank === 3) {
      list.push({ label: '🛡️ Hào Kiệt Đồng #3', bg: '#ffedd5', color: '#c2410c', border: '#fdba74' });
    } else if (topPercent && topPercent <= 20) {
      list.push({ label: '⭐ Tinh Anh CLB', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' });
    }

    if (player.streak >= 3) {
      list.push({ label: `🔥 Bất Bại (+${player.streak})`, bg: '#fef2f2', color: '#b91c1c', border: '#fca5a5' });
    }
    if (totalMatches >= 15) {
      list.push({ label: '⚡ Cỗ Máy Ra Sân', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' });
    }
    if (winRate >= 70 && totalMatches >= 5) {
      list.push({ label: `💎 Tỷ Lệ Vàng ${winRate}%`, bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff' });
    }
    if (player.doublesRating >= 4.5 || player.singlesRating >= 4.5) {
      list.push({ label: '🏆 Đại Sư DUPR', bg: '#fffbeb', color: '#d97706', border: '#fde68a' });
    }
    if (totalMatches < 5) {
      list.push({ label: '🌱 Hạt Giống Mới', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' });
    }
    return list;
  }, [clubRank, topPercent, player.streak, totalMatches, winRate, player.doublesRating, player.singlesRating]);

  const latestDelta = history.length > 0
    ? [...history].sort((a, b) => b.time - a.time)[0].delta
    : null;

  const handleExport = () => {
    const rows = [
      ['Ngày', 'Chế độ', 'Đối thủ', 'Kết quả', 'Tỉ số', 'Điểm DUPR'],
      ...filteredHistory.map((h) => [
        new Date(h.time).toLocaleString('vi-VN'),
        MODE_META[h.match.importance].label,
        h.opponents.map((p) => p.name).join(' & '),
        h.won ? 'Thắng' : 'Thua',
        h.scoreText,
        h.delta.toFixed(3),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `lich-su-dau-${displayId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const content = (
    <>
      {onClose && <ScreenHeader title="Hồ sơ vận động viên" onBack={onClose} />}

      {/* 1. PROFILE HEADER */}
      <MobileCard style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar player={player} size={68} ring="#10b981" />
            {onEditProfile && (
              <button
                onClick={onEditProfile}
                title="Chỉnh sửa hồ sơ"
                aria-label="Chỉnh sửa hồ sơ"
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                <Pencil size={13} />
              </button>
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: '0 0 4px 0' }}>
              {player.name}
            </h1>
            <span style={{
              display: 'inline-block',
              background: '#ecfdf5',
              color: '#059669',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 10px',
              borderRadius: 999,
              border: '1px solid #a7f3d0',
            }}>
              {player.role === 'owner' ? 'Chủ CLB' : player.role === 'admin' ? 'Quản trị viên' : 'Thành viên CLB'}
            </span>
            <button
              onClick={handleCopyId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                marginTop: 4,
              }}
            >
              <span>ID: {displayId}</span>
              {copiedId ? <Check size={13} color="#059669" /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        {clubRank > 0 && (
          <div style={{
            flex: '1 1 150px',
            background: clubRank === 1 
              ? 'linear-gradient(135deg, #fef3c7, #fffbeb)' 
              : clubRank === 2
              ? 'linear-gradient(135deg, #f1f5f9, #ffffff)'
              : clubRank === 3
              ? 'linear-gradient(135deg, #ffedd5, #fff7ed)'
              : 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
            border: `1.5px solid ${clubRank === 1 ? '#fcd34d' : clubRank === 2 ? '#cbd5e1' : clubRank === 3 ? '#fdba74' : '#bbf7d0'}`,
            borderRadius: 16,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{ fontSize: '2rem', lineHeight: 1 }}>{clubRank === 1 ? '👑' : clubRank === 2 ? '🥈' : clubRank === 3 ? '🥉' : '💪'}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: 600 }}>Danh hiệu thứ hạng</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.98rem', fontWeight: 900, color: clubRank === 1 ? '#b45309' : clubRank === 2 ? '#334155' : clubRank === 3 ? '#c2410c' : '#064030' }}>
                {clubRank === 1 ? '👑 VUA SÂN ĐẤU' : clubRank === 2 ? '⚔️ CHIẾN THẦN BẠC' : clubRank === 3 ? '🛡️ HÀO KIỆT ĐỒNG' : `Hạng ${clubRank} CLB`}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>Top {topPercent}% CLB</div>
            </div>
          </div>
        )}

        {/* Danh hiệu danh dự đã đạt được */}
        {honorBadges.length > 0 && (
          <div style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 10, borderTop: '1px dashed #e2e8f0' }}>
            {honorBadges.map((badge, idx) => (
              <span
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: badge.bg,
                  color: badge.color,
                  border: `1px solid ${badge.border}`,
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 999,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}
      </MobileCard>

      {/* 2. PERSONAL STATS */}
      <MobileCard style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <BarChart3 size={20} color="#059669" />
          <h3 style={{ fontSize: '1.02rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>Thống kê cá nhân</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: 8, marginBottom: 10 }}>
          <StatTile icon={<Gamepad2 size={20} color="#2563eb" />} tint="#eff6ff" value={totalMatches} label="Trận đã chơi" />
          <StatTile icon={<Trophy size={20} color="#059669" />} tint="#ecfdf5" value={totalWins} label="Thắng" />
          <StatTile icon={<XCircle size={20} color="#dc2626" />} tint="#fef2f2" value={totalLosses} label="Thua" />
          <StatTile icon={<PieChart size={20} color="#059669" />} tint="#ecfdf5" value={`${winRate}%`} label="Tỉ lệ thắng" />
          <StatTile
            icon={<Flame size={20} color={player.streak >= 0 ? '#ea580c' : '#64748b'} />}
            tint={player.streak > 0 ? '#fff7ed' : '#f8fafc'}
            value={player.streak > 0 ? `+${player.streak}` : player.streak}
            label="Chuỗi trận"
          />
          <StatTile
            icon={<Activity size={20} color={(player.pointDifferential || 0) >= 0 ? '#059669' : '#dc2626'} />}
            tint={(player.pointDifferential || 0) >= 0 ? '#ecfdf5' : '#fef2f2'}
            value={(player.pointDifferential || 0) > 0 ? `+${player.pointDifferential}` : player.pointDifferential || 0}
            label="Hiệu số điểm"
          />
        </div>

        {/* 2 DUPR RATINGS CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 10 }}>
          {/* DUPR Đôi */}
          <div style={{ border: '1.5px solid #d1fae5', background: '#f0fdf4', borderRadius: 14, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#065f46' }}>DUPR ĐÔI (2vs2)</span>
              <span style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                padding: '2px 6px',
                borderRadius: 6,
                background: player.matchesPlayedDoubles >= 10 ? '#dcfce7' : '#fef3c7',
                color: player.matchesPlayedDoubles >= 10 ? '#15803d' : '#b45309',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}>
                {player.matchesPlayedDoubles >= 10 ? <CheckCircle2 size={10} /> : null}
                {player.matchesPlayedDoubles >= 10 ? 'Đã xác thực' : 'Tạm tính (<10)'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="mono" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#064e3b' }}>
                {player.doublesRating.toFixed(3)}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#047857' }}>
                {player.matchesPlayedDoubles} trận ({player.winsDoubles}T - {player.lossesDoubles}B)
              </span>
            </div>
            {latestDelta !== null && (
              <div style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                marginTop: 4,
                color: latestDelta >= 0 ? '#16a34a' : '#dc2626',
              }}>
                {latestDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                <span>{latestDelta >= 0 ? '+' : ''}{latestDelta.toFixed(3)} gần nhất</span>
              </div>
            )}
          </div>

          {/* DUPR Đơn */}
          <div style={{ border: '1.5px solid #e2e8f0', background: '#ffffff', borderRadius: 14, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569' }}>DUPR ĐƠN (1vs1)</span>
              <span style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                padding: '2px 6px',
                borderRadius: 6,
                background: player.matchesPlayedSingles >= 10 ? '#dcfce7' : '#fef3c7',
                color: player.matchesPlayedSingles >= 10 ? '#15803d' : '#b45309',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}>
                {player.matchesPlayedSingles >= 10 ? <CheckCircle2 size={10} /> : null}
                {player.matchesPlayedSingles >= 10 ? 'Đã xác thực' : 'Tạm tính (<10)'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="mono" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a' }}>
                {player.singlesRating.toFixed(3)}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                {player.matchesPlayedSingles} trận ({player.winsSingles}T - {player.lossesSingles}B)
              </span>
            </div>
          </div>
        </div>

        {/* Form 5 trận */}
        <div style={{ border: '1px solid #e8eef0', borderRadius: 14, padding: 12 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: 8 }}>
            Kết quả 5 trận gần nhất
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {player.form.slice(0, 5).map((item, idx) => (
              <div
                key={idx}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: item === 'W' ? '#16a34a' : '#dc2626',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.72rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item === 'W' ? 'T' : 'B'}
              </div>
            ))}
            {player.form.length === 0 && <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Chưa có trận nào</span>}
          </div>
        </div>
      </MobileCard>

      {/* 3. MATCH RELATIONSHIPS */}
      <MobileCard style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Users size={20} color="#2563eb" />
          <h3 style={{ fontSize: '1.02rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>Các mối quan hệ thi đấu</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          <RelationCard emoji="⚡" title="Song Sát Huỷ Diệt" tint="#f0fdf4" border="#c9f0d6" stat={teammatesByRate[0]} good onSelectPlayer={onSelectPlayer} />
          <RelationCard emoji="🧩" title="Lệch Nhịp Phối Hợp" tint="#fff1f1" border="#fcd9d9" stat={worst(teammatesByRate)} good={false} onSelectPlayer={onSelectPlayer} />
          <RelationCard emoji="🎯" title="Khắc Tinh Sân Đấu" tint="#eff6ff" border="#d5e5fb" stat={opponentsByRate[0]} good onSelectPlayer={onSelectPlayer} />
          <RelationCard emoji="🧱" title="Bức Tường Thép" tint="#fff1f1" border="#fcd9d9" stat={worst(opponentsByRate)} good={false} onSelectPlayer={onSelectPlayer} />
        </div>
      </MobileCard>

      {/* 4. TABS */}
      <div style={{ marginBottom: 12 }}>
        <PillToggle
          stretch
          value={tab}
          onChange={setTab}
          options={[
            { value: 'headToHead', label: 'Đối đầu', icon: <Swords size={14} /> },
            { value: 'history', label: 'Lịch sử đấu', icon: <Clock size={14} /> },
            { value: 'teammates', label: 'Đồng đội', icon: <Users size={14} /> },
          ]}
        />
      </div>

      {tab === 'headToHead' && (
        <MobileCard>
          <h3 style={{ fontSize: '0.98rem', fontWeight: 900, color: '#0f172a', margin: '0 0 4px 0' }}>Danh sách đối đầu</h3>
          <RelationList items={relations.opponents} emptyText="Chưa có trận đối đầu nào được ghi nhận." onSelectPlayer={onSelectPlayer} />
        </MobileCard>
      )}

      {tab === 'teammates' && (
        <MobileCard>
          <h3 style={{ fontSize: '0.98rem', fontWeight: 900, color: '#0f172a', margin: '0 0 4px 0' }}>Thành tích đồng đội</h3>
          <RelationList items={teammatesByRate} emptyText="Chưa có trận đánh đôi nào được ghi nhận." onSelectPlayer={onSelectPlayer} />
        </MobileCard>
      )}

      {tab === 'history' && (
        <MobileCard>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>Lịch sử đấu</h3>
            <button
              onClick={handleExport}
              disabled={filteredHistory.length === 0}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#2563eb',
                fontSize: '0.74rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: filteredHistory.length === 0 ? 'not-allowed' : 'pointer',
                opacity: filteredHistory.length === 0 ? 0.5 : 1,
              }}
            >
              <Download size={14} />
              <span>Xuất thống kê</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginBottom: 8 }}>
            <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value as ModeFilter)} aria-label="Chế độ" style={selectStyle}>
              <option value="all">Tất cả chế độ</option>
              <option value="casual">{MODE_META.casual.label}</option>
              <option value="sanctioned">{MODE_META.sanctioned.label}</option>
              <option value="league">{MODE_META.league.label}</option>
            </select>
            <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodFilter)} aria-label="Thời gian" style={selectStyle}>
              <option value="all">Tất cả thời gian</option>
              <option value="month">Tháng này</option>
              <option value="year">Năm nay</option>
            </select>
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')} aria-label="Sắp xếp" style={selectStyle}>
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
            </select>
          </div>

          {filteredHistory.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '58px 18px minmax(0, 1fr) 44px 40px 46px',
              gap: 6,
              padding: '6px 0',
              borderBottom: '1px solid #eef2f4',
              fontSize: '0.64rem',
              fontWeight: 700,
              color: '#94a3b8',
              textAlign: 'center',
            }}>
              <span style={{ textAlign: 'left' }}>Ngày</span>
              <span />
              <span style={{ textAlign: 'left' }}>Đối thủ</span>
              <span>Kết quả</span>
              <span>Tỉ số</span>
              <span>DUPR</span>
            </div>
          )}

          {filteredHistory.map((h) => {
            const date = new Date(h.time);
            return (
              <div
                key={h.match.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '58px 18px minmax(0, 1fr) 44px 40px 46px',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 0',
                  borderBottom: '1px solid #f4f6f8',
                }}
              >
                <div style={{ fontSize: '0.64rem', color: '#64748b', lineHeight: 1.3 }}>
                  <div>{date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                  <div>{date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <span title={MODE_META[h.match.importance].label} style={{ display: 'flex' }}>
                  {MODE_META[h.match.importance].icon}
                </span>
                <div
                  onClick={() => h.opponents[0] && onSelectPlayer && onSelectPlayer(h.opponents[0])}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, cursor: onSelectPlayer ? 'pointer' : 'default' }}
                  title={onSelectPlayer && h.opponents[0] ? `Xem hồ sơ ${h.opponents[0].name}` : undefined}
                >
                  {h.opponents[0] && <Avatar player={h.opponents[0]} size={26} />}
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {h.opponents.map((p) => p.name).join(' & ')}
                  </span>
                </div>
                <span style={{
                  fontSize: '0.66rem',
                  fontWeight: 800,
                  textAlign: 'center',
                  padding: '3px 0',
                  borderRadius: 6,
                  background: h.won ? '#dcfce7' : '#fee2e2',
                  color: h.won ? '#15803d' : '#b91c1c',
                }}>
                  {h.won ? 'Thắng' : 'Thua'}
                </span>
                <span className="mono" style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0f172a', textAlign: 'center' }}>
                  {h.scoreText}
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textAlign: 'right',
                  color: h.delta >= 0 ? '#16a34a' : '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                }}>
                  {h.delta >= 0 ? '+' : ''}{h.delta.toFixed(3)}
                </span>
              </div>
            );
          })}

          {filteredHistory.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', fontSize: '0.82rem', color: '#94a3b8' }}>
              {history.length === 0 ? 'Chưa có trận đấu nào được ghi nhận.' : 'Không có trận nào khớp bộ lọc.'}
            </div>
          )}
        </MobileCard>
      )}
    </>
  );

  if (viewMode === 'mobile') return <MobilePage>{content}</MobilePage>;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 40px' }}>
      {content}
    </div>
  );
};
