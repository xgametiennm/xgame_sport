import React, { useState } from 'react';
import { usePickleball } from '../context/PickleballContext';
import { buildMatchResult } from '../utils/buildMatchResult';
import { GameFormat, MatchImportance } from '../types/pickleball';
import { X, Save } from 'lucide-react';
import confetti from 'canvas-confetti';

interface MatchRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MatchRecorderModal: React.FC<MatchRecorderModalProps> = ({ isOpen, onClose }) => {
  const { players, recordNewMatch, selectedClub, lang } = usePickleball();

  const [format, setFormat] = useState<GameFormat>('doubles');
  const [importance] = useState<MatchImportance>('league');

  // Player selections
  const [t1p1Id, setT1p1Id] = useState<string>(players[0]?.id || '');
  const [t1p2Id, setT1p2Id] = useState<string>(players[2]?.id || '');
  const [t2p1Id, setT2p1Id] = useState<string>(players[1]?.id || '');
  const [t2p2Id, setT2p2Id] = useState<string>(players[3]?.id || '');

  // Date & Subsequent match
  const [matchDate, setMatchDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [isSubsequentMatch, setIsSubsequentMatch] = useState<boolean>(false);

  // Scores
  const [score1, setScore1] = useState<number>(11);
  const [score2, setScore2] = useState<number>(8);
  const [notes] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const p1 = players.find((p) => p.id === t1p1Id);
    const p2 = format === 'doubles' ? players.find((p) => p.id === t1p2Id) : undefined;
    const p3 = players.find((p) => p.id === t2p1Id);
    const p4 = format === 'doubles' ? players.find((p) => p.id === t2p2Id) : undefined;

    if (!p1 || !p3) return;

    try {
      const res = await recordNewMatch({
        ...buildMatchResult({
          id: `match-${Date.now()}`,
          date: new Date(matchDate).toISOString(),
          format,
          importance,
          courtName: `${selectedClub.name} - Sân CLB`,
          team1: [p1, p2],
          team2: [p3, p4],
          score1,
          score2,
          notes,
        }),
        isSubsequentMatch,
      });

      if (res?.autoConfirmed) {
        window.alert(res.message || 'Trận đấu đã được ghi nhận trước đó. Hệ thống đã tự động gộp và xác nhận kết quả cho bạn!');
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Không lưu được trận đấu');
      return;
    }

    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.5 },
      });
    } catch {
      // ignore
    }

    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>
            {lang === 'vi' ? 'Ghi Nhận Trận Đấu Mới' : 'Record New Match'}
          </h2>
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

          {/* Match Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
              📅 Ngày diễn ra trận đấu:
            </label>
            <input
              type="date"
              value={matchDate}
              onChange={(e) => setMatchDate(e.target.value)}
              className="input-dark"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: '0.88rem' }}
              required
            />
          </div>

          {/* Team 1 selection */}
          <div style={{ background: '#ecfdf5', padding: 12, borderRadius: 12, border: '1px solid #a7f3d0' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#059669', marginBottom: 8 }}>ĐỘI 1</div>
            <div style={{ display: 'grid', gridTemplateColumns: format === 'doubles' ? 'repeat(auto-fit, minmax(140px, 1fr))' : '1fr', gap: 8 }}>
              <select
                value={t1p1Id}
                onChange={(e) => setT1p1Id(e.target.value)}
                className="input-dark"
                style={{ minWidth: 0 }}
                required
              >
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.doublesRating})</option>
                ))}
              </select>

              {format === 'doubles' && (
                <select
                  value={t1p2Id}
                  onChange={(e) => setT1p2Id(e.target.value)}
                  className="input-dark"
                  style={{ minWidth: 0 }}
                  required
                >
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.doublesRating})</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Team 2 selection */}
          <div style={{ background: '#f0f9ff', padding: 12, borderRadius: 12, border: '1px solid #bae6fd' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0284c7', marginBottom: 8 }}>ĐỘI 2</div>
            <div style={{ display: 'grid', gridTemplateColumns: format === 'doubles' ? 'repeat(auto-fit, minmax(140px, 1fr))' : '1fr', gap: 8 }}>
              <select
                value={t2p1Id}
                onChange={(e) => setT2p1Id(e.target.value)}
                className="input-dark"
                style={{ minWidth: 0 }}
                required
              >
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.doublesRating})</option>
                ))}
              </select>

              {format === 'doubles' && (
                <select
                  value={t2p2Id}
                  onChange={(e) => setT2p2Id(e.target.value)}
                  className="input-dark"
                  style={{ minWidth: 0 }}
                  required
                >
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.doublesRating})</option>
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
                max="30"
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
                max="30"
                value={score2}
                onChange={(e) => setScore2(parseInt(e.target.value) || 0)}
                className="input-dark mono"
                style={{ fontSize: '1.4rem', fontWeight: 900, textAlign: 'center', color: '#0284c7' }}
                required
              />
            </div>
          </div>

          {/* Subsequent match checkbox */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            borderRadius: 10,
            background: isSubsequentMatch ? '#ecfdf5' : '#f8fafc',
            border: isSubsequentMatch ? '1.5px solid #059669' : '1px solid #e2e8f0',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontWeight: 700,
            color: isSubsequentMatch ? '#065f46' : '#64748b',
            transition: 'all 0.15s ease',
          }}>
            <input
              type="checkbox"
              checked={isSubsequentMatch}
              onChange={(e) => setIsSubsequentMatch(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#059669', cursor: 'pointer' }}
            />
            <span>Đây là trận tiếp theo / Set đấu mới giữa các VĐV này (không gộp kết quả)</span>
          </label>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', marginTop: 4, padding: '12px', fontSize: '1rem' }}
          >
            <Save size={18} />
            <span>Lưu Trận Đấu & Cập Nhật DUPR Tức Thì</span>
          </button>
        </form>
      </div>
    </div>
  );
};
