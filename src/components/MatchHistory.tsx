import React, { useState, useMemo } from 'react';
import { usePickleball } from '../context/PickleballContext';
import { Player, GameFormat, MatchImportance } from '../types/pickleball';
import { 
  Trophy, 
  Search, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Activity, 
  ChevronDown, 
  ChevronUp, 
  Zap,
  Users,
  Edit3,
  Trash2
} from 'lucide-react';
import { EditMatchModal } from './EditMatchModal';
import { MatchResult } from '../types/pickleball';

interface MatchHistoryProps {
  onOpenRecordMatch: () => void;
  onSelectPlayer?: (player: Player) => void;
}

const PAGE_SIZE = 15;

export const MatchHistory: React.FC<MatchHistoryProps> = ({ onOpenRecordMatch, onSelectPlayer }) => {
  const { matches, selectedClub, isManager, deleteMatch } = usePickleball();
  const [editingMatch, setEditingMatch] = useState<MatchResult | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<'all' | GameFormat>('all');
  const [selectedImportance, setSelectedImportance] = useState<'all' | MatchImportance>('all');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const handleDeleteMatch = async (match: MatchResult) => {
    const s1 = match.sets && match.sets.length > 0 ? match.sets[0].team1 : match.totalScoreTeam1;
    const s2 = match.sets && match.sets.length > 0 ? match.sets[0].team2 : match.totalScoreTeam2;
    const p1 = match.team1.player1?.name || 'Đội 1';
    const p2 = match.team2.player1?.name || 'Đội 2';
    const ok = window.confirm(
      `Bạn có chắc chắn muốn xóa kết quả trận đấu này?\n\n` +
      `Trận: ${p1} vs ${p2} (${match.courtName || 'Sân CLB'})\n` +
      `Tỉ số: ${s1} - ${s2}\n\n` +
      `⚠️ Lưu ý: Hệ thống sẽ tự động hoàn tác điểm DUPR, số trận thắng/thua, hiệu số và chuỗi của các VĐV liên quan.`
    );
    if (!ok) return;

    try {
      await deleteMatch(match.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Không xóa được trận đấu');
    }
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setVisibleCount(PAGE_SIZE);
  };
  const handleFormatChange = (fmt: 'all' | GameFormat) => {
    setSelectedFormat(fmt);
    setVisibleCount(PAGE_SIZE);
  };
  const handleImportanceChange = (imp: 'all' | MatchImportance) => {
    setSelectedImportance(imp);
    setVisibleCount(PAGE_SIZE);
  };

  // Filtered matches
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      // Filter format
      if (selectedFormat !== 'all' && m.format !== selectedFormat) return false;

      // Filter importance
      if (selectedImportance !== 'all' && m.importance !== selectedImportance) return false;

      // Search player name
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const p1 = m.team1.player1?.name?.toLowerCase() || '';
        const p2 = m.team1.player2?.name?.toLowerCase() || '';
        const p3 = m.team2.player1?.name?.toLowerCase() || '';
        const p4 = m.team2.player2?.name?.toLowerCase() || '';
        const court = m.courtName?.toLowerCase() || '';
        const notes = m.notes?.toLowerCase() || '';

        if (!p1.includes(query) && !p2.includes(query) && !p3.includes(query) && !p4.includes(query) && !court.includes(query) && !notes.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [matches, selectedFormat, selectedImportance, searchQuery]);

  const visibleMatches = useMemo(() => {
    return filteredMatches.slice(0, visibleCount);
  }, [filteredMatches, visibleCount]);

  // Overall Statistics Calculation
  const stats = useMemo(() => {
    const total = matches.length;
    let doublesCount = 0;
    let singlesCount = 0;
    let maxDelta = 0;
    let avgDeltaSum = 0;

    matches.forEach((m) => {
      if (m.format === 'doubles') doublesCount++;
      else singlesCount++;

      const absDelta = Math.abs(m.team1.deltaRating || 0);
      avgDeltaSum += absDelta;
      if (absDelta > maxDelta) maxDelta = absDelta;
    });

    const avgDelta = total > 0 ? (avgDeltaSum / total).toFixed(3) : '0.000';

    return {
      total,
      doublesCount,
      singlesCount,
      maxDelta: maxDelta.toFixed(3),
      avgDelta,
    };
  }, [matches]);

  const toggleExpand = (id: string) => {
    setExpandedMatchId((prev) => (prev === id ? null : id));
  };

  const formatDate = (dateString: string) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 16px' }}>
      {/* 1. HERO HEADER */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 24,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: '1.6rem' }}>📜</span>
            <h1 style={{
              fontSize: '1.75rem',
              fontWeight: 900,
              color: '#0f172a',
              margin: 0,
              letterSpacing: '-0.02em',
            }}>
              Lịch Sử Trận Đấu CLB
            </h1>
            <span style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: '#ecfdf5',
              border: '1px solid #10b981',
              color: '#059669',
              fontSize: '0.78rem',
              fontWeight: 800,
            }}>
              {selectedClub.name}
            </span>
          </div>
          <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
            Toàn bộ diễn biến các trận đấu, điểm số từng set và dữ liệu biến động DUPR Rating minh bạch.
          </p>
        </div>

        {/* Action Button: Ghi trận mới */}
        <button
          onClick={onOpenRecordMatch}
          className="btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 20px',
            borderRadius: 14,
            fontWeight: 800,
            fontSize: '0.92rem',
            boxShadow: '0 4px 14px rgba(5, 150, 105, 0.3)',
          }}
        >
          <Plus size={18} />
          <span>Ghi Nhận Trận Đấu Mới</span>
        </button>
      </div>

      {/* 2. STATS BENTO OVERVIEW */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14,
        marginBottom: 24,
      }}>
        {/* Card 1: Total matches */}
        <div className="card" style={{ padding: '18px 20px', background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b' }}>Tổng Số Trận</span>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a' }}>
            {stats.total} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>trận</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700, marginTop: 4 }}>
            Đã đồng bộ vào cơ sở dữ liệu
          </div>
        </div>

        {/* Card 2: Doubles ratio */}
        <div className="card" style={{ padding: '18px 20px', background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b' }}>Trận Đôi / Trận Đơn</span>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a' }}>
            {stats.doublesCount} <span style={{ fontSize: '1.2rem', color: '#cbd5e1' }}>/</span> {stats.singlesCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 700, marginTop: 4 }}>
            {stats.total > 0 ? Math.round((stats.doublesCount / stats.total) * 100) : 0}% Trận đánh đôi
          </div>
        </div>

        {/* Card 3: Avg DUPR delta */}
        <div className="card" style={{ padding: '18px 20px', background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b' }}>Biến Động DUPR TB</span>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a' }}>
            ±{stats.avgDelta}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 700, marginTop: 4 }}>
            Theo thuật toán DUPR Half-life
          </div>
        </div>

        {/* Card 4: Max delta */}
        <div className="card" style={{ padding: '18px 20px', background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b' }}>Cách Biệt Lớn Nhất</span>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#fdf2f8', color: '#db2777', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#db2777' }}>
            +{stats.maxDelta}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginTop: 4 }}>
            Trận đấu bất ngờ nhất (Upset)
          </div>
        </div>
      </div>

      {/* 3. FILTER & SEARCH CONTROLS */}
      <div style={{
        background: '#ffffff',
        padding: '16px 20px',
        borderRadius: 18,
        border: '1px solid #e2e8f0',
        marginBottom: 20,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
      }}>
        {/* Search input */}
        <div style={{ position: 'relative', flex: '1 1 280px', minWidth: 240 }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 14, top: 11 }} />
          <input
            type="text"
            placeholder="Tìm theo tên VĐV, tên sân, ghi chú trận..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="input-light"
            style={{ paddingLeft: 40, width: '100%', borderRadius: 12, fontSize: '0.88rem' }}
          />
        </div>

        {/* Format Filter Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f1f5f9', padding: 4, borderRadius: 12 }}>
          <button
            onClick={() => handleFormatChange('all')}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              background: selectedFormat === 'all' ? '#ffffff' : 'transparent',
              color: selectedFormat === 'all' ? '#0f172a' : '#64748b',
              boxShadow: selectedFormat === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            Tất Cả Thể Thức
          </button>
          <button
            onClick={() => handleFormatChange('doubles')}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              background: selectedFormat === 'doubles' ? '#ffffff' : 'transparent',
              color: selectedFormat === 'doubles' ? '#059669' : '#64748b',
              boxShadow: selectedFormat === 'doubles' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            🎾 Đánh Đôi
          </button>
          <button
            onClick={() => handleFormatChange('singles')}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              background: selectedFormat === 'singles' ? '#ffffff' : 'transparent',
              color: selectedFormat === 'singles' ? '#2563eb' : '#64748b',
              boxShadow: selectedFormat === 'singles' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            👤 Đánh Đơn
          </button>
        </div>

        {/* Importance Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={selectedImportance}
            onChange={(e) => handleImportanceChange(e.target.value as any)}
            className="input-light"
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <option value="all">Tất cả mức độ</option>
            <option value="league">Giải CLB (League)</option>
            <option value="casual">Giao hữu (Casual)</option>
            <option value="sanctioned">Giải chính thức (Sanctioned)</option>
          </select>
        </div>
      </div>

      {/* 4. MATCH LIST CARDS */}
      {filteredMatches.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: '#ffffff',
          borderRadius: 20,
          border: '1px dashed #cbd5e1',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎾</div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
            Không tìm thấy trận đấu nào
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#64748b', maxWidth: 400, margin: '0 auto 18px' }}>
            Không có kết quả phù hợp với bộ lọc hiện tại. Bạn có thể xóa bộ lọc hoặc ghi nhận một trận đấu mới!
          </p>
          <button
            onClick={onOpenRecordMatch}
            className="btn-primary"
            style={{ padding: '10px 20px', borderRadius: 12, fontWeight: 800, fontSize: '0.88rem' }}
          >
            Ghi Trận Đấu Đầu Tiên
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {visibleMatches.map((match) => {
            const isTeam1Winner = match.winner === 1;
            const isExpanded = expandedMatchId === match.id;
            const team1Delta = match.team1.deltaRating;
            const team2Delta = match.team2.deltaRating;
            const score1 = match.sets && match.sets.length > 0 ? match.sets[0].team1 : match.totalScoreTeam1;
            const score2 = match.sets && match.sets.length > 0 ? match.sets[0].team2 : match.totalScoreTeam2;

            return (
              <div
                key={match.id}
                className="card"
                style={{
                  background: '#ffffff',
                  borderRadius: 18,
                  border: isExpanded ? '2px solid #059669' : '1px solid #e2e8f0',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* MATCH CARD TOP BAR */}
                <div style={{
                  padding: '12px 20px',
                  background: '#f8fafc',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {/* Format Badge */}
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      background: match.format === 'doubles' ? '#ecfdf5' : '#eff6ff',
                      color: match.format === 'doubles' ? '#059669' : '#2563eb',
                      border: `1px solid ${match.format === 'doubles' ? '#a7f3d0' : '#bfdbfe'}`,
                    }}>
                      {match.format === 'doubles' ? '🎾 ĐÔI' : '👤 ĐƠN'}
                    </span>

                    {/* Importance Badge */}
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: match.importance === 'league' ? '#fef3c7' : match.importance === 'sanctioned' ? '#fdf2f8' : '#f1f5f9',
                      color: match.importance === 'league' ? '#d97706' : match.importance === 'sanctioned' ? '#db2777' : '#475569',
                    }}>
                      {match.importance === 'league' ? 'Giải CLB' : match.importance === 'sanctioned' ? 'Sanctioned' : 'Giao hữu'}
                    </span>

                    {/* Court Name */}
                    {match.courtName && (
                      <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                        📍 {match.courtName}
                      </span>
                    )}

                    {/* Last Updated Badge */}
                    {match.updatedByName && (
                      <span
                        title={`Kết quả trận đấu được cập nhật lần cuối bởi ${match.updatedByName}${match.updatedAt ? ` lúc ${formatDate(match.updatedAt)}` : ''}`}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: '#fefce8',
                          color: '#854d0e',
                          border: '1px solid #fef08a',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span>✏️ Đã sửa bởi: {match.updatedByName}</span>
                      </span>
                    )}
                  </div>

                  {/* Date & Expand Button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                      <Calendar size={14} />
                      <span>{formatDate(match.date)}</span>
                    </div>

                    {isManager && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingMatch(match);
                          }}
                          title="Quản trị viên & Chủ CLB: Chỉnh sửa kết quả trận đấu"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 10px',
                            borderRadius: 8,
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#0d5e46',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                          }}
                        >
                          <Edit3 size={13} color="#059669" />
                          <span>Sửa</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMatch(match);
                          }}
                          title="Quản trị viên & Chủ CLB: Xóa kết quả trận đấu"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 10px',
                            borderRadius: 8,
                            border: '1px solid #fecaca',
                            background: '#fef2f2',
                            color: '#dc2626',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                          }}
                        >
                          <Trash2 size={13} color="#dc2626" />
                          <span>Xóa</span>
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => toggleExpand(match.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      <span>{isExpanded ? 'Ẩn chi tiết' : 'Chi tiết DUPR'}</span>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* MATCH CARD BODY: TEAM 1 VS TEAM 2 */}
                <div 
                  className="match-card-grid"
                  style={{
                    padding: '20px',
                  }}
                >
                  {/* TEAM 1 */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: 14,
                    background: isTeam1Winner ? 'linear-gradient(135deg, #f0fdf4, #ffffff)' : '#ffffff',
                    border: isTeam1Winner ? '1.5px solid #86efac' : '1px solid #e2e8f0',
                  }}>
                    <div>
                      {/* Winner Badge */}
                      {isTeam1Winner && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#16a34a', fontSize: '0.75rem', fontWeight: 900, marginBottom: 6 }}>
                          <Trophy size={14} fill="#16a34a" />
                          <span>ĐỘI CHIẾN THẮNG</span>
                        </div>
                      )}

                      {/* Players */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div 
                          onClick={() => onSelectPlayer && onSelectPlayer(match.team1.player1)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        >
                          <img
                            src={match.team1.player1?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=P1'}
                            alt=""
                            style={{ width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9' }}
                          />
                          <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                            {match.team1.player1?.name || 'VĐV 1'}
                          </span>
                        </div>

                        {match.team1.player2 && (
                          <div 
                            onClick={() => onSelectPlayer && onSelectPlayer(match.team1.player2!)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                          >
                            <img
                              src={match.team1.player2?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=P2'}
                              alt=""
                              style={{ width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9' }}
                            />
                            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                              {match.team1.player2?.name}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* DUPR Delta */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: '0.76rem',
                          fontWeight: 900,
                          background: team1Delta >= 0 ? '#dcfce7' : '#fee2e2',
                          color: team1Delta >= 0 ? '#15803d' : '#b91c1c',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}>
                          {team1Delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                          <span>{team1Delta >= 0 ? `+${team1Delta.toFixed(3)}` : team1Delta.toFixed(3)}</span>
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          DUPR TB: {match.team1.startRatingAvg?.toFixed(2)} → {match.team1.newRatingAvg?.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SINGLE SET SCOREBOARD IN CENTER */}
                  <div style={{
                    textAlign: 'center',
                    minWidth: 120,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}>
                    <div style={{
                      padding: '8px 18px',
                      borderRadius: 14,
                      background: '#064030',
                      color: '#ffffff',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '1.6rem',
                      fontWeight: 900,
                      letterSpacing: '2px',
                      boxShadow: '0 4px 14px rgba(6, 64, 48, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      <span style={{ color: isTeam1Winner ? '#bef264' : '#e2e8f0' }}>{score1}</span>
                      <span style={{ color: '#ffffff', opacity: 0.35, fontSize: '1.2rem' }}>:</span>
                      <span style={{ color: !isTeam1Winner ? '#bef264' : '#e2e8f0' }}>{score2}</span>
                    </div>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      color: '#059669',
                      background: '#ecfdf5',
                      padding: '3px 10px',
                      borderRadius: 999,
                      border: '1px solid #a7f3d0',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}>
                      Kết quả 1 Set
                    </span>
                  </div>

                  {/* TEAM 2 */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    padding: '14px 16px',
                    borderRadius: 14,
                    background: !isTeam1Winner ? 'linear-gradient(135deg, #f0fdf4, #ffffff)' : '#ffffff',
                    border: !isTeam1Winner ? '1.5px solid #86efac' : '1px solid #e2e8f0',
                  }}>
                    <div style={{ textAlign: 'right' }}>
                      {/* Winner Badge */}
                      {!isTeam1Winner && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, color: '#16a34a', fontSize: '0.75rem', fontWeight: 900, marginBottom: 6 }}>
                          <Trophy size={14} fill="#16a34a" />
                          <span>ĐỘI CHIẾN THẮNG</span>
                        </div>
                      )}

                      {/* Players */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                        <div 
                          onClick={() => onSelectPlayer && onSelectPlayer(match.team2.player1)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        >
                          <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                            {match.team2.player1?.name || 'VĐV 3'}
                          </span>
                          <img
                            src={match.team2.player1?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=P3'}
                            alt=""
                            style={{ width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9' }}
                          />
                        </div>

                        {match.team2.player2 && (
                          <div 
                            onClick={() => onSelectPlayer && onSelectPlayer(match.team2.player2!)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                          >
                            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                              {match.team2.player2?.name}
                            </span>
                            <img
                              src={match.team2.player2?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=P4'}
                              alt=""
                              style={{ width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9' }}
                            />
                          </div>
                        )}
                      </div>

                      {/* DUPR Delta */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          DUPR TB: {match.team2.startRatingAvg?.toFixed(2)} → {match.team2.newRatingAvg?.toFixed(2)}
                        </span>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: '0.76rem',
                          fontWeight: 900,
                          background: team2Delta >= 0 ? '#dcfce7' : '#fee2e2',
                          color: team2Delta >= 0 ? '#15803d' : '#b91c1c',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}>
                          {team2Delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                          <span>{team2Delta >= 0 ? `+${team2Delta.toFixed(3)}` : team2Delta.toFixed(3)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* EXPANDED METRICS DETAILS (DUPR MATHEMATICAL BREAKDOWN) */}
                {isExpanded && (
                  <div style={{
                    padding: '16px 20px',
                    background: '#f8fafc',
                    borderTop: '1px solid #f1f5f9',
                    fontSize: '0.82rem',
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                      {/* Expected vs Actual */}
                      <div style={{ background: '#ffffff', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                          Kỳ vọng chiến thắng (Win Prob)
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                          <span>Đội 1: {Math.round((match.expectedWinProbTeam1 || 0.5) * 100)}%</span>
                          <span>Đội 2: {Math.round((match.expectedWinProbTeam2 || 0.5) * 100)}%</span>
                        </div>
                        <div style={{ height: 6, background: '#e2e8f0', borderRadius: 999, marginTop: 6, overflow: 'hidden', display: 'flex' }}>
                          <div style={{ width: `${(match.expectedWinProbTeam1 || 0.5) * 100}%`, background: '#059669' }} />
                          <div style={{ width: `${(match.expectedWinProbTeam2 || 0.5) * 100}%`, background: '#3b82f6' }} />
                        </div>
                      </div>

                      {/* Point share */}
                      <div style={{ background: '#ffffff', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                          Tỉ lệ điểm thực tế (Point Share)
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                          <span>Đội 1: {Math.round((match.actualPointsShareTeam1 || 0.5) * 100)}%</span>
                          <span>Kỳ vọng: {Math.round((match.expectedPointsShareTeam1 || 0.5) * 100)}%</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: 4, fontWeight: 700 }}>
                          Hệ số cách biệt MoV: x{match.marginOfVictoryFactor || 1.0}
                        </div>
                      </div>

                      {/* Notes */}
                      {match.notes && (
                        <div style={{ background: '#ffffff', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                            Ghi chú trận đấu
                          </div>
                          <div style={{ color: '#475569', fontStyle: 'italic' }}>
                            "{match.notes}"
                          </div>
                        </div>
                      )}

                      {/* Last Updated Note */}
                      {match.updatedByName && (
                        <div style={{
                          background: '#fefce8',
                          padding: 12,
                          borderRadius: 10,
                          border: '1px solid #fef08a',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                        }}>
                          <div style={{ fontWeight: 800, color: '#854d0e', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>✏️ Lịch sử chỉnh sửa</span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#713f12', lineHeight: 1.4 }}>
                            Cập nhật lần cuối bởi: <strong>{match.updatedByName}</strong>
                            {match.updatedAt && (
                              <div style={{ fontSize: '0.74rem', color: '#854d0e', marginTop: 2 }}>
                                Thời gian: {formatDate(match.updatedAt)}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Load More Button */}
          {filteredMatches.length > visibleCount && (
            <div style={{ textAlign: 'center', marginTop: 12, marginBottom: 12 }}>
              <button
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="btn-secondary"
                style={{
                  padding: '12px 28px',
                  borderRadius: 14,
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  color: '#059669',
                  border: '1.5px solid #a7f3d0',
                  background: '#ecfdf5',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.08)',
                }}
              >
                Xem thêm {Math.min(PAGE_SIZE, filteredMatches.length - visibleCount)} trận tiếp theo (còn {filteredMatches.length - visibleCount} trận)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Edit Match Modal for Admins & Owners */}
      <EditMatchModal
        isOpen={!!editingMatch}
        match={editingMatch}
        onClose={() => setEditingMatch(null)}
      />
    </div>
  );
};
