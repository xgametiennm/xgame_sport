import React, { useState, useEffect, useMemo } from 'react';
import { usePickleball } from '../context/PickleballContext';
import { buildMatchResult } from '../utils/buildMatchResult';
import { GameFormat, MatchImportance, Player } from '../types/pickleball';
import { 
  validatePickleballSet, 
  validatePickleballMatch, 
  SetScore 
} from '../utils/pickleballValidator';
import { X, Save, ArrowLeftRight, CheckCircle2, AlertCircle, Trophy, Layers } from 'lucide-react';
import confetti from 'canvas-confetti';

interface MatchRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MatchRecorderModal: React.FC<MatchRecorderModalProps> = ({ isOpen, onClose }) => {
  const { players, recordNewMatch, selectedClub, lang, myPlayer } = usePickleball();

  const [format, setFormat] = useState<GameFormat>('doubles');
  const [matchMode, setMatchMode] = useState<'single' | 'best_of_3'>('single');
  const [targetScore, setTargetScore] = useState<number>(11);
  const [importance, setImportance] = useState<MatchImportance>('league');
  const [courtName, setCourtName] = useState<string>('Sân 1');

  // Player selections
  const [t1p1Id, setT1p1Id] = useState<string>('');
  const [t1p2Id, setT1p2Id] = useState<string>('');
  const [t2p1Id, setT2p1Id] = useState<string>('');
  const [t2p2Id, setT2p2Id] = useState<string>('');

  // Date & Subsequent match
  const [matchDate, setMatchDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [isSubsequentMatch, setIsSubsequentMatch] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');

  // Sets state
  const [set1, setSet1] = useState<SetScore>({ team1: 11, team2: 8 });
  const [set2, setSet2] = useState<SetScore>({ team1: 8, team2: 11 });
  const [set3, setSet3] = useState<SetScore>({ team1: 11, team2: 9 });

  // Initialize player defaults on open
  useEffect(() => {
    if (!isOpen || players.length === 0) return;

    const myId = myPlayer?.id;
    const available = players.map((p) => p.id);

    const first = (myId && available.includes(myId)) ? myId : available[0] || '';
    const remaining = available.filter((id) => id !== first);

    setT1p1Id(first);
    setT1p2Id(remaining[1] || remaining[0] || '');
    setT2p1Id(remaining[0] || '');
    setT2p2Id(remaining[2] || remaining[1] || '');

    setCourtName(selectedClub.courtsCount && selectedClub.courtsCount > 1 ? 'Sân 1' : `${selectedClub.name} - Sân CLB`);
  }, [isOpen, players, myPlayer, selectedClub]);

  // Validation calculations
  const val1 = useMemo(() => validatePickleballSet(set1.team1, set1.team2, targetScore), [set1, targetScore]);
  const val2 = useMemo(() => validatePickleballSet(set2.team1, set2.team2, targetScore), [set2, targetScore]);
  const val3 = useMemo(() => validatePickleballSet(set3.team1, set3.team2, targetScore), [set3, targetScore]);

  // Determine if Set 3 is needed in Best of 3
  const isSet3Needed = useMemo(() => {
    if (matchMode !== 'best_of_3') return false;
    if (!val1.valid || !val2.valid) return false;
    return val1.winner !== val2.winner; // 1-1 split
  }, [matchMode, val1, val2]);

  // Overall match validation
  const matchValidation = useMemo(() => {
    const activeSets: SetScore[] = matchMode === 'single'
      ? [set1]
      : (val1.winner !== val2.winner ? [set1, set2, set3] : [set1, set2]);

    return validatePickleballMatch(matchMode, activeSets, targetScore);
  }, [matchMode, set1, set2, set3, targetScore, val1, val2]);

  if (!isOpen) return null;

  // Swap Teams button handler
  const handleSwapTeams = () => {
    const tempP1 = t1p1Id;
    const tempP2 = t1p2Id;
    setT1p1Id(t2p1Id);
    setT1p2Id(t2p2Id);
    setT2p1Id(tempP1);
    setT2p2Id(tempP2);

    setSet1({ team1: set1.team2, team2: set1.team1 });
    setSet2({ team1: set2.team2, team2: set2.team1 });
    setSet3({ team1: set3.team2, team2: set3.team1 });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const p1 = players.find((p) => p.id === t1p1Id);
    const p2 = format === 'doubles' ? players.find((p) => p.id === t1p2Id) : undefined;
    const p3 = players.find((p) => p.id === t2p1Id);
    const p4 = format === 'doubles' ? players.find((p) => p.id === t2p2Id) : undefined;

    if (!p1 || !p3) {
      window.alert('Vui lòng chọn đầy đủ VĐV cho 2 đội');
      return;
    }
    if (format === 'doubles' && (!p2 || !p4)) {
      window.alert('Trận đấu đôi bắt buộc phải có đủ 2 VĐV mỗi đội');
      return;
    }

    const selectedIds = [p1.id, p2?.id, p3.id, p4?.id].filter(Boolean);
    if (new Set(selectedIds).size !== selectedIds.length) {
      window.alert('Không thể chọn cùng một VĐV cho nhiều vị trí trong trận đấu');
      return;
    }

    if (!matchValidation.valid) {
      window.alert(`Tỉ số chưa hợp lệ theo luật Pickleball:\n\n${matchValidation.error}`);
      return;
    }

    try {
      const res = await recordNewMatch({
        ...buildMatchResult({
          id: `match-${Date.now()}`,
          date: new Date(matchDate).toISOString(),
          format,
          importance,
          courtName,
          team1: [p1, p2],
          team2: [p3, p4],
          sets: matchValidation.sets,
          bestOfSets: matchMode === 'best_of_3' ? 3 : 1,
          targetScore,
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
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          padding: '24px 28px', 
          maxWidth: 640, 
          maxHeight: '90vh', 
          overflowY: 'auto' 
        }}
      >
        {/* MODAL HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🏓</span>
              <span>{lang === 'vi' ? 'Ghi Nhận Kết Quả Trận Đấu' : 'Record Match Result'}</span>
            </h2>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
              Hệ thống DUPR & Luật thi đấu Pickleball chính thức (Win by 2)
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 1. MATCH FORMAT & MODE SELECTOR */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {/* Singles vs Doubles */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 10 }}>
              <button
                type="button"
                onClick={() => setFormat('doubles')}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: format === 'doubles' ? '#0d5e46' : 'transparent',
                  color: format === 'doubles' ? '#fff' : '#64748b',
                  transition: 'all 0.15s ease',
                }}
              >
                🎾 Đôi (2v2)
              </button>
              <button
                type="button"
                onClick={() => setFormat('singles')}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: format === 'singles' ? '#0d5e46' : 'transparent',
                  color: format === 'singles' ? '#fff' : '#64748b',
                  transition: 'all 0.15s ease',
                }}
              >
                👤 Đơn (1v1)
              </button>
            </div>

            {/* 1 Set vs Best of 3 */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 10 }}>
              <button
                type="button"
                onClick={() => setMatchMode('single')}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: matchMode === 'single' ? '#0d5e46' : 'transparent',
                  color: matchMode === 'single' ? '#fff' : '#64748b',
                  transition: 'all 0.15s ease',
                }}
              >
                1 Hiệp
              </button>
              <button
                type="button"
                onClick={() => setMatchMode('best_of_3')}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: matchMode === 'best_of_3' ? '#0d5e46' : 'transparent',
                  color: matchMode === 'best_of_3' ? '#fff' : '#64748b',
                  transition: 'all 0.15s ease',
                }}
              >
                Best of 3 (3 hiệp)
              </button>
            </div>
          </div>

          {/* 2. MATCH SETTINGS: TARGET SCORE & DATE */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            {/* Target Score */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                🎯 Điểm kết thúc hiệp:
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[11, 15, 21].map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => setTargetScore(pts)}
                    style={{
                      flex: 1,
                      padding: '6px',
                      borderRadius: 8,
                      border: targetScore === pts ? '1.5px solid #059669' : '1px solid #cbd5e1',
                      background: targetScore === pts ? '#ecfdf5' : '#ffffff',
                      color: targetScore === pts ? '#059669' : '#64748b',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {pts} {pts === 11 ? '(Chuẩn)' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Match Date */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                📅 Ngày thi đấu:
              </label>
              <input
                type="date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                className="input-dark"
                style={{ width: '100%', padding: '6px 10px', borderRadius: 8, fontSize: '0.85rem' }}
                required
              />
            </div>
          </div>

          {/* 3. PLAYER SELECTION (TEAM 1 VS TEAM 2) */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {/* TEAM 1 */}
              <div style={{ background: '#ecfdf5', padding: 12, borderRadius: 12, border: '1px solid #a7f3d0' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#059669', marginBottom: 6 }}>
                  ĐỘI 1
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <select
                    value={t1p1Id}
                    onChange={(e) => setT1p1Id(e.target.value)}
                    className="input-dark"
                    style={{ fontSize: '0.82rem' }}
                    required
                  >
                    <option value="" disabled>Chọn VĐV 1...</option>
                    {players.map((p) => {
                      const isUsedElsewhere = [t1p2Id, t2p1Id, t2p2Id].includes(p.id);
                      return (
                        <option key={p.id} value={p.id} disabled={isUsedElsewhere}>
                          {p.name} ({format === 'doubles' ? p.doublesRating : p.singlesRating}) {isUsedElsewhere ? '(Đã chọn)' : ''}
                        </option>
                      );
                    })}
                  </select>

                  {format === 'doubles' && (
                    <select
                      value={t1p2Id}
                      onChange={(e) => setT1p2Id(e.target.value)}
                      className="input-dark"
                      style={{ fontSize: '0.82rem' }}
                      required
                    >
                      <option value="" disabled>Chọn VĐV 2...</option>
                      {players.map((p) => {
                        const isUsedElsewhere = [t1p1Id, t2p1Id, t2p2Id].includes(p.id);
                        return (
                          <option key={p.id} value={p.id} disabled={isUsedElsewhere}>
                            {p.name} ({p.doublesRating}) {isUsedElsewhere ? '(Đã chọn)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              </div>

              {/* TEAM 2 */}
              <div style={{ background: '#f0f9ff', padding: 12, borderRadius: 12, border: '1px solid #bae6fd' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0284c7', marginBottom: 6 }}>
                  ĐỘI 2
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <select
                    value={t2p1Id}
                    onChange={(e) => setT2p1Id(e.target.value)}
                    className="input-dark"
                    style={{ fontSize: '0.82rem' }}
                    required
                  >
                    <option value="" disabled>Chọn VĐV 1...</option>
                    {players.map((p) => {
                      const isUsedElsewhere = [t1p1Id, t1p2Id, t2p2Id].includes(p.id);
                      return (
                        <option key={p.id} value={p.id} disabled={isUsedElsewhere}>
                          {p.name} ({format === 'doubles' ? p.doublesRating : p.singlesRating}) {isUsedElsewhere ? '(Đã chọn)' : ''}
                        </option>
                      );
                    })}
                  </select>

                  {format === 'doubles' && (
                    <select
                      value={t2p2Id}
                      onChange={(e) => setT2p2Id(e.target.value)}
                      className="input-dark"
                      style={{ fontSize: '0.82rem' }}
                      required
                    >
                      <option value="" disabled>Chọn VĐV 2...</option>
                      {players.map((p) => {
                        const isUsedElsewhere = [t1p1Id, t1p2Id, t2p1Id].includes(p.id);
                        return (
                          <option key={p.id} value={p.id} disabled={isUsedElsewhere}>
                            {p.name} ({p.doublesRating}) {isUsedElsewhere ? '(Đã chọn)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Swap Teams Button */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
              <button
                type="button"
                onClick={handleSwapTeams}
                title="Hoán đổi vị trí Đội 1 và Đội 2"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 12px',
                  borderRadius: 20,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <ArrowLeftRight size={13} color="#059669" />
                <span>⇄ Đổi Bên / Đổi Đội</span>
              </button>
            </div>
          </div>

          {/* 4. SCORE INPUT SECTION */}
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 14, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                <Layers size={15} color="#059669" />
                <span>{matchMode === 'single' ? 'Tỉ số trận đấu (1 Hiệp)' : 'Tỉ số các hiệp đấu (Best of 3)'}</span>
              </div>

              {/* Quick Presets for Set 1 */}
              {matchMode === 'single' && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[
                    [targetScore, targetScore - 2],
                    [targetScore, targetScore - 3],
                    [targetScore, targetScore - 5],
                    [targetScore + 1, targetScore - 1],
                  ].map(([s1, s2]) => (
                    <button
                      key={`${s1}-${s2}`}
                      type="button"
                      onClick={() => setSet1({ team1: s1, team2: s2 })}
                      style={{
                        padding: '2px 7px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#334155',
                        cursor: 'pointer',
                      }}
                    >
                      {s1}-{s2}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* SET 1 */}
            <div style={{ marginBottom: matchMode === 'best_of_3' ? 12 : 0 }}>
              {matchMode === 'best_of_3' && (
                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                  Hiệp 1:
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
                <div>
                  <input
                    type="number"
                    min="0"
                    max="40"
                    value={set1.team1}
                    onChange={(e) => setSet1({ ...set1, team1: parseInt(e.target.value) || 0 })}
                    className="input-dark mono"
                    style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', color: '#059669' }}
                    required
                  />
                  <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>Đội 1</div>
                </div>

                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#94a3b8' }}>:</div>

                <div>
                  <input
                    type="number"
                    min="0"
                    max="40"
                    value={set1.team2}
                    onChange={(e) => setSet1({ ...set1, team2: parseInt(e.target.value) || 0 })}
                    className="input-dark mono"
                    style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', color: '#0284c7' }}
                    required
                  />
                  <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>Đội 2</div>
                </div>
              </div>

              {/* Set 1 Validation Feedback */}
              <div style={{ marginTop: 4, fontSize: '0.74rem' }}>
                {val1.valid ? (
                  <span style={{ color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <CheckCircle2 size={12} />
                    <span>Hợp lệ: Đội {val1.winner} thắng ({set1.team1} - {set1.team2}, cách biệt {val1.diff} điểm)</span>
                  </span>
                ) : (
                  <span style={{ color: '#dc2626', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <AlertCircle size={12} />
                    <span>{val1.error}</span>
                  </span>
                )}
              </div>
            </div>

            {/* SET 2 & SET 3 (IF BEST OF 3) */}
            {matchMode === 'best_of_3' && (
              <>
                {/* SET 2 */}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #cbd5e1' }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                    Hiệp 2:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
                    <div>
                      <input
                        type="number"
                        min="0"
                        max="40"
                        value={set2.team1}
                        onChange={(e) => setSet2({ ...set2, team1: parseInt(e.target.value) || 0 })}
                        className="input-dark mono"
                        style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', color: '#059669' }}
                        required
                      />
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#94a3b8' }}>:</div>
                    <div>
                      <input
                        type="number"
                        min="0"
                        max="40"
                        value={set2.team2}
                        onChange={(e) => setSet2({ ...set2, team2: parseInt(e.target.value) || 0 })}
                        className="input-dark mono"
                        style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', color: '#0284c7' }}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 4, fontSize: '0.74rem' }}>
                    {val2.valid ? (
                      <span style={{ color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <CheckCircle2 size={12} />
                        <span>Hợp lệ: Đội {val2.winner} thắng ({set2.team1} - {set2.team2}, cách biệt {val2.diff} điểm)</span>
                      </span>
                    ) : (
                      <span style={{ color: '#dc2626', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <AlertCircle size={12} />
                        <span>{val2.error}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* SET 3 OR FINISHED 2-0 NOTICE */}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #cbd5e1' }}>
                  {!isSet3Needed && val1.valid && val2.valid && val1.winner === val2.winner ? (
                    <div style={{
                      background: '#ecfdf5',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #a7f3d0',
                      color: '#065f46',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <Trophy size={14} color="#059669" />
                      <span>Đã có kết quả chung cuộc: Đội {val1.winner} thắng 2 - 0 sau 2 hiệp. Không cần đánh Hiệp 3!</span>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#b45309', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>🔥 Hiệp 3 (Quyết định):</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>Cần đấu khi 2 đội hòa 1-1 sau 2 hiệp</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
                        <div>
                          <input
                            type="number"
                            min="0"
                            max="40"
                            value={set3.team1}
                            onChange={(e) => setSet3({ ...set3, team1: parseInt(e.target.value) || 0 })}
                            className="input-dark mono"
                            style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', color: '#059669' }}
                            required={isSet3Needed}
                          />
                        </div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#94a3b8' }}>:</div>
                        <div>
                          <input
                            type="number"
                            min="0"
                            max="40"
                            value={set3.team2}
                            onChange={(e) => setSet3({ ...set3, team2: parseInt(e.target.value) || 0 })}
                            className="input-dark mono"
                            style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', color: '#0284c7' }}
                            required={isSet3Needed}
                          />
                        </div>
                      </div>

                      {isSet3Needed && (
                        <div style={{ marginTop: 4, fontSize: '0.74rem' }}>
                          {val3.valid ? (
                            <span style={{ color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <CheckCircle2 size={12} />
                              <span>Hợp lệ: Đội {val3.winner} thắng Hiệp 3 ({set3.team1} - {set3.team2})</span>
                            </span>
                          ) : (
                            <span style={{ color: '#dc2626', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <AlertCircle size={12} />
                              <span>{val3.error}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* OVERALL MATCH RESULT BANNER */}
            {matchValidation.valid && (
              <div style={{
                marginTop: 12,
                padding: '8px 12px',
                borderRadius: 10,
                background: '#064030',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800 }}>
                  <Trophy size={15} color="#bef264" />
                  <span>
                    Chung cuộc: ĐỘI {matchValidation.winner} CHIẾN THẮNG
                    {matchMode === 'best_of_3' && ` (${matchValidation.team1SetsWon} - ${matchValidation.team2SetsWon})`}
                  </span>
                </div>
                <div style={{ color: '#bef264', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>
                  {matchValidation.sets.map((s) => `${s.team1}-${s.team2}`).join(' | ')}
                </div>
              </div>
            )}
          </div>

          {/* 5. SUBSEQUENT MATCH CHECKBOX */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            borderRadius: 10,
            background: isSubsequentMatch ? '#ecfdf5' : '#f8fafc',
            border: isSubsequentMatch ? '1.5px solid #059669' : '1px solid #e2e8f0',
            cursor: 'pointer',
            fontSize: '0.8rem',
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

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={!matchValidation.valid}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '0.95rem',
              opacity: matchValidation.valid ? 1 : 0.6,
              cursor: matchValidation.valid ? 'pointer' : 'not-allowed',
            }}
          >
            <Save size={18} />
            <span>Lưu Trận Đấu & Cập Nhật DUPR Tức Thì</span>
          </button>
        </form>
      </div>
    </div>
  );
};
