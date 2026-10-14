import React, { useState, useEffect } from 'react';
import { usePickleball } from '../context/PickleballContext';
import { buildMatchResult } from '../utils/buildMatchResult';
import { GameFormat, MatchImportance, MatchResult } from '../types/pickleball';
import { X, Save, Edit3 } from 'lucide-react';

interface EditMatchModalProps {
  isOpen: boolean;
  match: MatchResult | null;
  onClose: () => void;
}

export const EditMatchModal: React.FC<EditMatchModalProps> = ({ isOpen, match, onClose }) => {
  const { players, updateMatch, selectedClub, lang } = usePickleball();

  const [format, setFormat] = useState<GameFormat>('doubles');
  const [importance, setImportance] = useState<MatchImportance>('league');
  const [courtName, setCourtName] = useState<string>('Sân CLB');
  const [notes, setNotes] = useState<string>('');

  // Player selections
  const [t1p1Id, setT1p1Id] = useState<string>('');
  const [t1p2Id, setT1p2Id] = useState<string>('');
  const [t2p1Id, setT2p1Id] = useState<string>('');
  const [t2p2Id, setT2p2Id] = useState<string>('');

  // Scores
  const [score1, setScore1] = useState<number>(11);
  const [score2, setScore2] = useState<number>(8);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!match) return;
    setFormat(match.format || 'doubles');
    setImportance(match.importance || 'league');
    setCourtName(match.courtName || `${selectedClub.name} - Sân CLB`);
    setNotes(match.notes || '');

    setT1p1Id(match.team1?.player1?.id || '');
    setT1p2Id(match.team1?.player2?.id || '');
    setT2p1Id(match.team2?.player1?.id || '');
    setT2p2Id(match.team2?.player2?.id || '');

    const s1 = match.sets && match.sets.length > 0 ? match.sets[0].team1 : match.totalScoreTeam1;
    const s2 = match.sets && match.sets.length > 0 ? match.sets[0].team2 : match.totalScoreTeam2;
    setScore1(Number(s1) || 0);
    setScore2(Number(s2) || 0);
  }, [match, selectedClub.name]);

  if (!isOpen || !match) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const p1 = players.find((p) => p.id === t1p1Id);
    const p2 = format === 'doubles' ? players.find((p) => p.id === t1p2Id) : undefined;
    const p3 = players.find((p) => p.id === t2p1Id);
    const p4 = format === 'doubles' ? players.find((p) => p.id === t2p2Id) : undefined;

    if (!p1 || !p3) {
      window.alert('Vui lòng chọn đầy đủ người chơi cho 2 đội');
      return;
    }
    if (format === 'doubles' && (!p2 || !p4)) {
      window.alert('Trận đánh đôi yêu cầu đủ 2 người chơi mỗi đội');
      return;
    }
    const allIds = [p1.id, p2?.id, p3.id, p4?.id].filter(Boolean);
    if (new Set(allIds).size !== allIds.length) {
      window.alert('Một người chơi không thể thi đấu cho nhiều vị trí trong cùng một trận');
      return;
    }

    try {
      setLoading(true);
      const updatedData = buildMatchResult({
        id: match.id,
        date: match.date,
        format,
        importance,
        courtName,
        team1: [p1, p2],
        team2: [p3, p4],
        score1,
        score2,
        notes,
      });

      await updateMatch(match.id, updatedData);
      onClose();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Không cập nhật được trận đấu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1050 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: 28, maxWidth: 540 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: '#fef3c7',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Edit3 size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                {lang === 'vi' ? 'Chỉnh Sửa Kết Quả Trận Đấu' : 'Edit Match Result'}
              </h2>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                Dành cho Quản trị viên & Chủ câu lạc bộ
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{
          padding: '10px 14px',
          borderRadius: 12,
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          fontSize: '0.78rem',
          color: '#1e40af',
          marginBottom: 14,
          lineHeight: 1.4,
        }}>
          💡 <strong>Lưu ý:</strong> Khi bạn chỉnh sửa tỉ số hoặc người chơi, hệ thống sẽ tự động hoàn tác kết quả cũ và tính toán lại điểm DUPR, chuỗi thắng và hiệu số cho tất cả vận động viên liên quan.
        </div>

        {match.updatedByName && (
          <div style={{
            padding: '8px 12px',
            borderRadius: 10,
            background: '#fefce8',
            border: '1px solid #fef08a',
            fontSize: '0.76rem',
            color: '#854d0e',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span>✏️</span>
            <span>
              Lần sửa gần nhất bởi: <strong>{match.updatedByName}</strong>
              {match.updatedAt && ` (${new Date(match.updatedAt).toLocaleString('vi-VN')})`}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Format selection */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => setFormat('doubles')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: 'none',
                fontWeight: 800,
                cursor: 'pointer',
                background: format === 'doubles' ? '#0d5e46' : '#f1f5f9',
                color: format === 'doubles' ? '#fff' : '#64748b',
              }}
            >
              Đôi (2v2)
            </button>
            <button
              type="button"
              onClick={() => setFormat('singles')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: 'none',
                fontWeight: 800,
                cursor: 'pointer',
                background: format === 'singles' ? '#0d5e46' : '#f1f5f9',
                color: format === 'singles' ? '#fff' : '#64748b',
              }}
            >
              Đơn (1v1)
            </button>
          </div>

          {/* Team 1 selection */}
          <div style={{ background: '#ecfdf5', padding: 12, borderRadius: 12, border: '1px solid #a7f3d0' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#059669', marginBottom: 8 }}>ĐỘI 1</div>
            <div style={{ display: 'grid', gridTemplateColumns: format === 'doubles' ? '1fr 1fr' : '1fr', gap: 8 }}>
              <select
                value={t1p1Id}
                onChange={(e) => setT1p1Id(e.target.value)}
                className="input-dark"
                required
              >
                <option value="">-- Chọn VĐV 1 --</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.doublesRating.toFixed(2)})</option>
                ))}
              </select>

              {format === 'doubles' && (
                <select
                  value={t1p2Id}
                  onChange={(e) => setT1p2Id(e.target.value)}
                  className="input-dark"
                  required
                >
                  <option value="">-- Chọn VĐV 2 --</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.doublesRating.toFixed(2)})</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Team 2 selection */}
          <div style={{ background: '#f0f9ff', padding: 12, borderRadius: 12, border: '1px solid #bae6fd' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0284c7', marginBottom: 8 }}>ĐỘI 2</div>
            <div style={{ display: 'grid', gridTemplateColumns: format === 'doubles' ? '1fr 1fr' : '1fr', gap: 8 }}>
              <select
                value={t2p1Id}
                onChange={(e) => setT2p1Id(e.target.value)}
                className="input-dark"
                required
              >
                <option value="">-- Chọn VĐV 1 --</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.doublesRating.toFixed(2)})</option>
                ))}
              </select>

              {format === 'doubles' && (
                <select
                  value={t2p2Id}
                  onChange={(e) => setT2p2Id(e.target.value)}
                  className="input-dark"
                  required
                >
                  <option value="">-- Chọn VĐV 2 --</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.doublesRating.toFixed(2)})</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Scores */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#059669', marginBottom: 4 }}>
                Điểm Đội 1:
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={score1}
                onChange={(e) => setScore1(parseInt(e.target.value) || 0)}
                className="input-dark mono"
                style={{ fontSize: '1.4rem', fontWeight: 900, textAlign: 'center', color: '#059669' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0284c7', marginBottom: 4 }}>
                Điểm Đội 2:
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={score2}
                onChange={(e) => setScore2(parseInt(e.target.value) || 0)}
                className="input-dark mono"
                style={{ fontSize: '1.4rem', fontWeight: 900, textAlign: 'center', color: '#0284c7' }}
                required
              />
            </div>
          </div>

          {/* Court & Notes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: 3 }}>
                Tên Sân:
              </label>
              <input
                type="text"
                value={courtName}
                onChange={(e) => setCourtName(e.target.value)}
                className="input-dark"
                placeholder="Ví dụ: Sân 1 - Trung tâm"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: 3 }}>
                Ghi chú:
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-dark"
                placeholder="Ghi chú trận đấu..."
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', marginTop: 8, padding: '12px', fontSize: '1rem', opacity: loading ? 0.7 : 1 }}
          >
            <Save size={18} />
            <span>{loading ? 'Đang cập nhật...' : 'Cập Nhật Kết Quả & Tính Lại DUPR'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
