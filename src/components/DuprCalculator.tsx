import React, { useState, useMemo, useEffect } from 'react';
import { usePickleball } from '../context/PickleballContext';
import { GameFormat, MatchImportance, SetScore, MatchResult } from '../types/pickleball';
import { calculateDupr } from '../utils/duprCalculator';
import { 
  Users, 
  User, 
  Sparkles, 
  CheckCircle, 
  Save, 
  TrendingUp
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const DuprCalculator: React.FC = () => {
  const { players, recordNewMatch, lang, selectedClub } = usePickleball();

  // Mode & configuration state
  const [format, setFormat] = useState<GameFormat>('doubles');
  const [importance, setImportance] = useState<MatchImportance>('league');
  const [bestOfSets, setBestOfSets] = useState<1 | 3>(1);
  const [targetScore] = useState<11 | 15 | 21>(11);

  // Team 1 players
  const [t1p1Name, setT1p1Name] = useState<string>(() => players[0]?.name || 'VĐV 1');
  const [t1p1Rating, setT1p1Rating] = useState<number>(() => players[0]?.doublesRating || 3.5);
  const [t1p1Matches, setT1p1Matches] = useState<number>(() => players[0]?.matchesPlayedDoubles || 0);

  const [t1p2Name, setT1p2Name] = useState<string>(() => players[1]?.name || 'VĐV 2');
  const [t1p2Rating, setT1p2Rating] = useState<number>(() => players[1]?.doublesRating || 3.5);
  const [t1p2Matches, setT1p2Matches] = useState<number>(() => players[1]?.matchesPlayedDoubles || 0);

  // Team 2 players
  const [t2p1Name, setT2p1Name] = useState<string>(() => players[2]?.name || 'VĐV 3');
  const [t2p1Rating, setT2p1Rating] = useState<number>(() => players[2]?.doublesRating || 3.5);
  const [t2p1Matches, setT2p1Matches] = useState<number>(() => players[2]?.matchesPlayedDoubles || 0);

  const [t2p2Name, setT2p2Name] = useState<string>(() => players[3]?.name || 'VĐV 4');
  const [t2p2Rating, setT2p2Rating] = useState<number>(() => players[3]?.doublesRating || 3.5);
  const [t2p2Matches, setT2p2Matches] = useState<number>(() => players[3]?.matchesPlayedDoubles || 0);

  // Auto-populate with real club players when players become available
  useEffect(() => {
    if (players.length >= 1 && (t1p1Name === 'VĐV 1' || t1p1Name === 'Minh Quân')) {
      const p0 = players[0];
      if (p0) {
        setT1p1Name(p0.name);
        setT1p1Rating(format === 'doubles' ? p0.doublesRating : p0.singlesRating);
        setT1p1Matches(format === 'doubles' ? p0.matchesPlayedDoubles : p0.matchesPlayedSingles);
      }
      const p1 = players[1];
      if (p1) {
        setT1p2Name(p1.name);
        setT1p2Rating(format === 'doubles' ? p1.doublesRating : p1.singlesRating);
        setT1p2Matches(format === 'doubles' ? p1.matchesPlayedDoubles : p1.matchesPlayedSingles);
      }
      const p2 = players[2];
      if (p2) {
        setT2p1Name(p2.name);
        setT2p1Rating(format === 'doubles' ? p2.doublesRating : p2.singlesRating);
        setT2p1Matches(format === 'doubles' ? p2.matchesPlayedDoubles : p2.matchesPlayedSingles);
      }
      const p3 = players[3];
      if (p3) {
        setT2p2Name(p3.name);
        setT2p2Rating(format === 'doubles' ? p3.doublesRating : p3.singlesRating);
        setT2p2Matches(format === 'doubles' ? p3.matchesPlayedDoubles : p3.matchesPlayedSingles);
      }
    }
  }, [players, format]);

  // Scores
  const [set1, setSet1] = useState<SetScore>({ team1: 11, team2: 7 });

  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Build sets array (Chỉ 1 set duy nhất)
  const activeSets = useMemo(() => {
    return [set1];
  }, [set1]);

  // Calculate DUPR
  const calcResult = useMemo(() => {
    return calculateDupr({
      format,
      importance,
      targetScore,
      winByTwo: true,
      bestOfSets,
      t1p1Rating,
      t1p1Matches,
      t1p2Rating: format === 'doubles' ? t1p2Rating : undefined,
      t1p2Matches: format === 'doubles' ? t1p2Matches : undefined,
      t2p1Rating,
      t2p1Matches,
      t2p2Rating: format === 'doubles' ? t2p2Rating : undefined,
      t2p2Matches: format === 'doubles' ? t2p2Matches : undefined,
      sets: activeSets,
    });
  }, [format, importance, targetScore, bestOfSets, t1p1Rating, t1p1Matches, t1p2Rating, t1p2Matches, t2p1Rating, t2p1Matches, t2p2Rating, t2p2Matches, activeSets]);

  // Handle preset score click
  const applyScorePreset = (s1: number, s2: number) => {
    setSet1({ team1: s1, team2: s2 });
    setIsSaved(false);
  };

  // Quick player select from roster
  const selectRosterPlayer = (slot: 't1p1' | 't1p2' | 't2p1' | 't2p2', playerId: string) => {
    const p = players.find((x) => x.id === playerId);
    if (!p) return;
    const r = format === 'doubles' ? p.doublesRating : p.singlesRating;
    const m = format === 'doubles' ? p.matchesPlayedDoubles : p.matchesPlayedSingles;
    
    if (slot === 't1p1') {
      setT1p1Name(p.name);
      setT1p1Rating(r);
      setT1p1Matches(m);
    } else if (slot === 't1p2') {
      setT1p2Name(p.name);
      setT1p2Rating(r);
      setT1p2Matches(m);
    } else if (slot === 't2p1') {
      setT2p1Name(p.name);
      setT2p1Rating(r);
      setT2p1Matches(m);
    } else if (slot === 't2p2') {
      setT2p2Name(p.name);
      setT2p2Rating(r);
      setT2p2Matches(m);
    }
    setIsSaved(false);
  };

  // Save match to club standings
  const handleSaveToClub = async () => {
    const t1p1Obj = players.find((p) => p.name === t1p1Name) || {
      id: `p-custom-${Date.now()}-1`,
      name: t1p1Name,
      doublesRating: t1p1Rating,
      singlesRating: t1p1Rating,
      provisionalDoubles: t1p1Matches < 10,
      provisionalSingles: t1p1Matches < 10,
      matchesPlayedDoubles: t1p1Matches,
      matchesPlayedSingles: t1p1Matches,
      winsDoubles: 0,
      lossesDoubles: 0,
      winsSingles: 0,
      lossesSingles: 0,
      pointDifferential: 0,
      streak: 0,
      form: [],
    };

    const t1p2Obj = format === 'doubles' ? (players.find((p) => p.name === t1p2Name) || {
      id: `p-custom-${Date.now()}-2`,
      name: t1p2Name,
      doublesRating: t1p2Rating,
      singlesRating: t1p2Rating,
      provisionalDoubles: t1p2Matches < 10,
      provisionalSingles: t1p2Matches < 10,
      matchesPlayedDoubles: t1p2Matches,
      matchesPlayedSingles: t1p2Matches,
      winsDoubles: 0,
      lossesDoubles: 0,
      winsSingles: 0,
      lossesSingles: 0,
      pointDifferential: 0,
      streak: 0,
      form: [],
    }) : undefined;

    const t2p1Obj = players.find((p) => p.name === t2p1Name) || {
      id: `p-custom-${Date.now()}-3`,
      name: t2p1Name,
      doublesRating: t2p1Rating,
      singlesRating: t2p1Rating,
      provisionalDoubles: t2p1Matches < 10,
      provisionalSingles: t2p1Matches < 10,
      matchesPlayedDoubles: t2p1Matches,
      matchesPlayedSingles: t2p1Matches,
      winsDoubles: 0,
      lossesDoubles: 0,
      winsSingles: 0,
      lossesSingles: 0,
      pointDifferential: 0,
      streak: 0,
      form: [],
    };

    const t2p2Obj = format === 'doubles' ? (players.find((p) => p.name === t2p2Name) || {
      id: `p-custom-${Date.now()}-4`,
      name: t2p2Name,
      doublesRating: t2p2Rating,
      singlesRating: t2p2Rating,
      provisionalDoubles: t2p2Matches < 10,
      provisionalSingles: t2p2Matches < 10,
      matchesPlayedDoubles: t2p2Matches,
      matchesPlayedSingles: t2p2Matches,
      winsDoubles: 0,
      lossesDoubles: 0,
      winsSingles: 0,
      lossesSingles: 0,
      pointDifferential: 0,
      streak: 0,
      form: [],
    }) : undefined;

    const total1 = activeSets.reduce((sum, s) => sum + s.team1, 0);
    const total2 = activeSets.reduce((sum, s) => sum + s.team2, 0);

    const newMatch: MatchResult = {
      id: `match-${Date.now()}`,
      date: new Date().toISOString(),
      format,
      importance,
      courtName: `${selectedClub.name} - Sân chính`,
      winner: calcResult.winner,
      sets: activeSets,
      totalScoreTeam1: total1,
      totalScoreTeam2: total2,
      team1: {
        player1: t1p1Obj,
        player2: t1p2Obj,
        startRatingAvg: calcResult.t1AvgRating,
        deltaRating: calcResult.ratingDeltaTeam1,
        newRatingAvg: parseFloat((calcResult.t1AvgRating + calcResult.ratingDeltaTeam1).toFixed(3)),
      },
      team2: {
        player1: t2p1Obj,
        player2: t2p2Obj,
        startRatingAvg: calcResult.t2AvgRating,
        deltaRating: calcResult.ratingDeltaTeam2,
        newRatingAvg: parseFloat((calcResult.t2AvgRating + calcResult.ratingDeltaTeam2).toFixed(3)),
      },
      expectedWinProbTeam1: calcResult.expectedWinProb1,
      expectedWinProbTeam2: calcResult.expectedWinProb2,
      expectedPointsShareTeam1: calcResult.expectedPointsShare1,
      actualPointsShareTeam1: calcResult.actualPointsShare1,
      marginOfVictoryFactor: calcResult.marginOfVictoryFactor,
      notes: calcResult.analysisExplanation,
    };

    try {
      await recordNewMatch(newMatch);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Không lưu được trận đấu');
      return;
    }
    setIsSaved(true);

    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#059669', '#84cc16', '#0284c7'],
      });
    } catch {
      // ignore
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      {/* Banner / Title */}
      <div className="hero-gradient card" style={{ marginBottom: 24, padding: '28px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span className="badge badge-neon" style={{ background: '#d9f99d', color: '#365314', border: '1px solid #bef264' }}>
            <Sparkles size={13} /> {lang === 'vi' ? 'THUẬT TOÁN DUPR CHUẨN QUỐC TẾ' : 'OFFICIAL DUPR ELO ALGORITHM'}
          </span>
          <span className="badge badge-court" style={{ background: '#d1fae5', color: '#065f46' }}>
            {selectedClub.name}
          </span>
        </div>
        <h1 style={{ fontSize: '2.1rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff', lineHeight: 1.15 }}>
          {lang === 'vi' ? 'Máy Tính Điểm & Biến Động DUPR' : 'DUPR Rating & Match Calculator'}
        </h1>
        <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.95rem', marginTop: 6, maxWidth: 720 }}>
          {lang === 'vi' 
            ? 'Mô phỏng chính xác biến động DUPR (thang 2.000 - 8.000) dựa trên xác suất kỳ vọng Elo, hiệu số tỷ số (Margin of Victory) và độ tin cậy số trận.'
            : 'Simulate precise DUPR rating delta (scale 2.000 - 8.000) using logistic expected win share, margin of victory multiplier, and match reliability.'}
        </p>
      </div>

      {/* Control bar: Format, Importance, Target score */}
      <div className="card" style={{ marginBottom: 24, padding: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Format (Doubles vs Singles) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              {lang === 'vi' ? 'Thể Thức:' : 'Format:'}
            </span>
            <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: 3, borderRadius: 999, border: '1px solid #e2e8f0' }}>
              <button
                onClick={() => { setFormat('doubles'); setIsSaved(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
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
                <span>{lang === 'vi' ? 'Đôi (2v2)' : 'Doubles (2v2)'}</span>
              </button>
              <button
                onClick={() => { setFormat('singles'); setIsSaved(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
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
                <span>{lang === 'vi' ? 'Đơn (1v1)' : 'Singles (1v1)'}</span>
              </button>
            </div>
          </div>

          {/* Match Importance */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              {lang === 'vi' ? 'Tính Chất:' : 'Tier:'}
            </span>
            <select
              value={importance}
              onChange={(e) => { setImportance(e.target.value as MatchImportance); setIsSaved(false); }}
              className="input-dark"
              style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto', fontWeight: 600 }}
            >
              <option value="league">{lang === 'vi' ? '🏆 CLB / Matchday League (K=0.12)' : '🏆 Club League (K=0.12)'}</option>
              <option value="sanctioned">{lang === 'vi' ? '⭐ Giải Chính Thức (K=0.18)' : '⭐ Sanctioned Tournament (K=0.18)'}</option>
              <option value="casual">{lang === 'vi' ? '🎯 Giao Lưu Vui Vẻ (K=0.08)' : '🎯 Casual Drop-in (K=0.08)'}</option>
            </select>
          </div>

          {/* Sets Configuration */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              {lang === 'vi' ? 'Số Set:' : 'Sets:'}
            </span>
            <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: 3, borderRadius: 999, border: '1px solid #e2e8f0' }}>
              <button
                onClick={() => { setBestOfSets(1); setIsSaved(false); }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: bestOfSets === 1 ? '#0d5e46' : 'transparent',
                  color: bestOfSets === 1 ? '#ffffff' : '#64748b',
                }}
              >
                1 Set ({targetScore} pts)
              </button>
              <button
                onClick={() => { setBestOfSets(3); setIsSaved(false); }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: bestOfSets === 3 ? '#0d5e46' : 'transparent',
                  color: bestOfSets === 3 ? '#ffffff' : '#64748b',
                }}
              >
                Best of 3
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Teams & Players (Light Card surfaces) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* TEAM 1 */}
        <div className="card" style={{ borderTop: '4px solid #059669' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                background: '#059669',
                color: '#ffffff',
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: '0.8rem',
                padding: '3px 8px',
                borderRadius: 6,
              }}>
                TEAM 1
              </span>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                {t1p1Name} {format === 'doubles' ? `& ${t1p2Name}` : ''}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>DUPR TB</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#059669', fontFamily: 'var(--font-mono)' }}>
                {calcResult.t1AvgRating.toFixed(3)}
              </div>
            </div>
          </div>

          {/* Player 1 Slot */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#059669' }}>
                {lang === 'vi' ? 'Vận Động Viên 1' : 'Player 1'}
              </label>
              <select
                onChange={(e) => selectRosterPlayer('t1p1', e.target.value)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                defaultValue=""
              >
                <option value="" disabled>{lang === 'vi' ? '⚡ Chọn từ CLB' : '⚡ Pick from Club'}</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({format === 'doubles' ? p.doublesRating : p.singlesRating})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                value={t1p1Name}
                onChange={(e) => { setT1p1Name(e.target.value); setIsSaved(false); }}
                className="input-dark"
                placeholder="Tên vận động viên"
              />
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  step="0.005"
                  min="2.000"
                  max="8.000"
                  value={t1p1Rating}
                  onChange={(e) => { setT1p1Rating(parseFloat(e.target.value) || 2.0); setIsSaved(false); }}
                  className="input-dark mono"
                  style={{ fontWeight: 800, paddingRight: 40, color: '#059669' }}
                />
                <span style={{ position: 'absolute', right: 8, top: 10, fontSize: '0.7rem', color: '#94a3b8' }}>DUPR</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
              <span>Số trận: {t1p1Matches} ({t1p1Matches < 10 ? 'Tạm thời' : 'Ổn định'})</span>
              <input
                type="range"
                min="2.000"
                max="7.000"
                step="0.025"
                value={t1p1Rating}
                onChange={(e) => { setT1p1Rating(parseFloat(e.target.value)); setIsSaved(false); }}
                style={{ width: 100, accentColor: '#059669' }}
              />
            </div>
          </div>

          {/* Player 2 Slot (If doubles) */}
          {format === 'doubles' && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#059669' }}>
                  {lang === 'vi' ? 'Vận Động Viên 2 (Bạn cặp)' : 'Player 2 (Partner)'}
                </label>
                <select
                  onChange={(e) => selectRosterPlayer('t1p2', e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                  defaultValue=""
                >
                  <option value="" disabled>{lang === 'vi' ? '⚡ Chọn từ CLB' : '⚡ Pick from Club'}</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.doublesRating})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  value={t1p2Name}
                  onChange={(e) => { setT1p2Name(e.target.value); setIsSaved(false); }}
                  className="input-dark"
                  placeholder="Tên vận động viên"
                />
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.005"
                    min="2.000"
                    max="8.000"
                    value={t1p2Rating}
                    onChange={(e) => { setT1p2Rating(parseFloat(e.target.value) || 2.0); setIsSaved(false); }}
                    className="input-dark mono"
                    style={{ fontWeight: 800, paddingRight: 40, color: '#059669' }}
                  />
                  <span style={{ position: 'absolute', right: 8, top: 10, fontSize: '0.7rem', color: '#94a3b8' }}>DUPR</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
                <span>Số trận: {t1p2Matches}</span>
                <input
                  type="range"
                  min="2.000"
                  max="7.000"
                  step="0.025"
                  value={t1p2Rating}
                  onChange={(e) => { setT1p2Rating(parseFloat(e.target.value)); setIsSaved(false); }}
                  style={{ width: 100, accentColor: '#059669' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* TEAM 2 */}
        <div className="card" style={{ borderTop: '4px solid #0284c7' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                background: '#0284c7',
                color: '#ffffff',
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: '0.8rem',
                padding: '3px 8px',
                borderRadius: 6,
              }}>
                TEAM 2
              </span>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                {t2p1Name} {format === 'doubles' ? `& ${t2p2Name}` : ''}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>DUPR TB</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0284c7', fontFamily: 'var(--font-mono)' }}>
                {calcResult.t2AvgRating.toFixed(3)}
              </div>
            </div>
          </div>

          {/* Player 1 Slot */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0284c7' }}>
                {lang === 'vi' ? 'Vận Động Viên 1' : 'Player 1'}
              </label>
              <select
                onChange={(e) => selectRosterPlayer('t2p1', e.target.value)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                defaultValue=""
              >
                <option value="" disabled>{lang === 'vi' ? '⚡ Chọn từ CLB' : '⚡ Pick from Club'}</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({format === 'doubles' ? p.doublesRating : p.singlesRating})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                value={t2p1Name}
                onChange={(e) => { setT2p1Name(e.target.value); setIsSaved(false); }}
                className="input-dark"
                placeholder="Tên vận động viên"
              />
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  step="0.005"
                  min="2.000"
                  max="8.000"
                  value={t2p1Rating}
                  onChange={(e) => { setT2p1Rating(parseFloat(e.target.value) || 2.0); setIsSaved(false); }}
                  className="input-dark mono"
                  style={{ fontWeight: 800, paddingRight: 40, color: '#0284c7' }}
                />
                <span style={{ position: 'absolute', right: 8, top: 10, fontSize: '0.7rem', color: '#94a3b8' }}>DUPR</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
              <span>Số trận: {t2p1Matches}</span>
              <input
                type="range"
                min="2.000"
                max="7.000"
                step="0.025"
                value={t2p1Rating}
                onChange={(e) => { setT2p1Rating(parseFloat(e.target.value)); setIsSaved(false); }}
                style={{ width: 100, accentColor: '#0284c7' }}
              />
            </div>
          </div>

          {/* Player 2 Slot (If doubles) */}
          {format === 'doubles' && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0284c7' }}>
                  {lang === 'vi' ? 'Vận Động Viên 2 (Bạn cặp)' : 'Player 2 (Partner)'}
                </label>
                <select
                  onChange={(e) => selectRosterPlayer('t2p2', e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                  defaultValue=""
                >
                  <option value="" disabled>{lang === 'vi' ? '⚡ Chọn từ CLB' : '⚡ Pick from Club'}</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.doublesRating})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  value={t2p2Name}
                  onChange={(e) => { setT2p2Name(e.target.value); setIsSaved(false); }}
                  className="input-dark"
                  placeholder="Tên vận động viên"
                />
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.005"
                    min="2.000"
                    max="8.000"
                    value={t2p2Rating}
                    onChange={(e) => { setT2p2Rating(parseFloat(e.target.value) || 2.0); setIsSaved(false); }}
                    className="input-dark mono"
                    style={{ fontWeight: 800, paddingRight: 40, color: '#0284c7' }}
                  />
                  <span style={{ position: 'absolute', right: 8, top: 10, fontSize: '0.7rem', color: '#94a3b8' }}>DUPR</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
                <span>Số trận: {t2p2Matches}</span>
                <input
                  type="range"
                  min="2.000"
                  max="7.000"
                  step="0.025"
                  value={t2p2Rating}
                  onChange={(e) => { setT2p2Rating(parseFloat(e.target.value)); setIsSaved(false); }}
                  style={{ width: 100, accentColor: '#0284c7' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Match Scores Input Section (Light Theme) */}
      <div className="card" style={{ marginBottom: 24, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a' }}>
            <span>🎾</span> {lang === 'vi' ? 'Nhập Tỷ Số Trận Đấu' : 'Match Score'}
          </h3>
          {/* Quick Score Preset Pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', alignSelf: 'center', fontWeight: 600 }}>Tỷ số nhanh:</span>
            <button onClick={() => applyScorePreset(11, 7)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>11 - 7</button>
            <button onClick={() => applyScorePreset(11, 9)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>11 - 9 (Tight)</button>
            <button onClick={() => applyScorePreset(11, 2)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>11 - 2 (Blowout)</button>
            <button onClick={() => applyScorePreset(9, 11)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>9 - 11</button>
            <button onClick={() => applyScorePreset(12, 10)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>12 - 10 (Deuce)</button>
          </div>
        </div>

        {/* Set 1 Inputs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: 16,
          alignItems: 'center',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          padding: 16,
          borderRadius: 16,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#059669', marginBottom: 6 }}>
              {t1p1Name} (Đội 1)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <button
                onClick={() => setSet1((prev) => ({ ...prev, team1: Math.max(0, prev.team1 - 1) }))}
                style={{ width: 34, height: 34, borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 800 }}
              >
                -
              </button>
              <input
                type="number"
                min="0"
                max="30"
                value={set1.team1}
                onChange={(e) => { setSet1((prev) => ({ ...prev, team1: parseInt(e.target.value) || 0 })); setIsSaved(false); }}
                className="mono"
                style={{
                  width: 70,
                  height: 48,
                  fontSize: '1.8rem',
                  fontWeight: 900,
                  textAlign: 'center',
                  background: '#ffffff',
                  border: '2px solid #059669',
                  borderRadius: 12,
                  color: '#0f172a',
                }}
              />
              <button
                onClick={() => setSet1((prev) => ({ ...prev, team1: prev.team1 + 1 }))}
                style={{ width: 34, height: 34, borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 800 }}
              >
                +
              </button>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>1 SET</span>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>chạm {targetScore} điểm</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0284c7', marginBottom: 6 }}>
              {t2p1Name} (Đội 2)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <button
                onClick={() => setSet1((prev) => ({ ...prev, team2: Math.max(0, prev.team2 - 1) }))}
                style={{ width: 34, height: 34, borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 800 }}
              >
                -
              </button>
              <input
                type="number"
                min="0"
                max="30"
                value={set1.team2}
                onChange={(e) => { setSet1((prev) => ({ ...prev, team2: parseInt(e.target.value) || 0 })); setIsSaved(false); }}
                className="mono"
                style={{
                  width: 70,
                  height: 48,
                  fontSize: '1.8rem',
                  fontWeight: 900,
                  textAlign: 'center',
                  background: '#ffffff',
                  border: '2px solid #0284c7',
                  borderRadius: 12,
                  color: '#0f172a',
                }}
              />
              <button
                onClick={() => setSet1((prev) => ({ ...prev, team2: prev.team2 + 1 }))}
                style={{ width: 34, height: 34, borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 800 }}
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DUPR CALCULATION RESULT BREAKDOWN (Light Card) */}
      <div className="card" style={{
        background: '#ffffff',
        border: '1.5px solid #059669',
        padding: 24,
        marginBottom: 24,
        boxShadow: '0 8px 24px rgba(5, 150, 105, 0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: '#0d5e46',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
            }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a' }}>
                {lang === 'vi' ? 'Kết Quả Biến Động DUPR' : 'Calculated DUPR Rating Delta'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                {lang === 'vi' ? 'Theo thuật toán chính xác Margin of Victory & Elo Logistic' : 'Based on Margin of Victory & Elo Logistic Distribution'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isSaved ? (
              <span className="badge badge-court" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                <CheckCircle size={15} /> {lang === 'vi' ? 'Đã Lưu Vào CLB' : 'Saved to Club'}
              </span>
            ) : (
              <button
                onClick={handleSaveToClub}
                className="btn-primary"
                style={{ padding: '10px 20px', fontSize: '0.88rem' }}
              >
                <Save size={16} />
                <span>{lang === 'vi' ? 'Lưu Kết Quả Vào CLB' : 'Save Result to Club'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Big Deltas Comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          {/* Team 1 Delta Card */}
          <div style={{
            background: calcResult.winner === 1 ? '#ecfdf5' : '#f8fafc',
            border: calcResult.winner === 1 ? '1.5px solid #059669' : '1px solid #e2e8f0',
            borderRadius: 16,
            padding: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="badge" style={{ background: calcResult.winner === 1 ? '#059669' : '#e2e8f0', color: calcResult.winner === 1 ? '#fff' : '#64748b', marginBottom: 4 }}>
                  {calcResult.winner === 1 ? '👑 THẮNG' : 'THUA'}
                </span>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
                  {t1p1Name} {format === 'doubles' ? `& ${t1p2Name}` : ''}
                </div>
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 900,
                fontSize: '1.75rem',
                color: calcResult.ratingDeltaTeam1 >= 0 ? '#059669' : '#e11d48',
              }}>
                {calcResult.ratingDeltaTeam1 >= 0 ? `+${calcResult.ratingDeltaTeam1.toFixed(3)}` : calcResult.ratingDeltaTeam1.toFixed(3)}
              </div>
            </div>

            {/* Individual New Ratings */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: '#64748b' }}>{t1p1Name}:</span>
                <span className="mono" style={{ fontWeight: 700, color: '#0f172a' }}>
                  {t1p1Rating.toFixed(3)} ➔ <strong style={{ color: '#059669' }}>{calcResult.t1p1New.toFixed(3)}</strong>
                </span>
              </div>
              {format === 'doubles' && calcResult.t1p2New && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#64748b' }}>{t1p2Name}:</span>
                  <span className="mono" style={{ fontWeight: 700, color: '#0f172a' }}>
                    {t1p2Rating.toFixed(3)} ➔ <strong style={{ color: '#059669' }}>{calcResult.t1p2New.toFixed(3)}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Team 2 Delta Card */}
          <div style={{
            background: calcResult.winner === 2 ? '#f0f9ff' : '#f8fafc',
            border: calcResult.winner === 2 ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
            borderRadius: 16,
            padding: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="badge" style={{ background: calcResult.winner === 2 ? '#0284c7' : '#e2e8f0', color: calcResult.winner === 2 ? '#fff' : '#64748b', marginBottom: 4 }}>
                  {calcResult.winner === 2 ? '👑 THẮNG' : 'THUA'}
                </span>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
                  {t2p1Name} {format === 'doubles' ? `& ${t2p2Name}` : ''}
                </div>
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 900,
                fontSize: '1.75rem',
                color: calcResult.ratingDeltaTeam2 >= 0 ? '#059669' : '#e11d48',
              }}>
                {calcResult.ratingDeltaTeam2 >= 0 ? `+${calcResult.ratingDeltaTeam2.toFixed(3)}` : calcResult.ratingDeltaTeam2.toFixed(3)}
              </div>
            </div>

            {/* Individual New Ratings */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: '#64748b' }}>{t2p1Name}:</span>
                <span className="mono" style={{ fontWeight: 700, color: '#0f172a' }}>
                  {t2p1Rating.toFixed(3)} ➔ <strong style={{ color: '#0284c7' }}>{calcResult.t2p1New.toFixed(3)}</strong>
                </span>
              </div>
              {format === 'doubles' && calcResult.t2p2New && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#64748b' }}>{t2p2Name}:</span>
                  <span className="mono" style={{ fontWeight: 700, color: '#0f172a' }}>
                    {t2p2Rating.toFixed(3)} ➔ <strong style={{ color: '#0284c7' }}>{calcResult.t2p2New.toFixed(3)}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Expected Win Probability & Statistical Details */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b' }}>
              Xác Suất Thắng Kỳ Vọng Trước Trận (Expected Win Probability)
            </span>
            <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: '#0f172a', fontWeight: 800 }}>
              {(calcResult.expectedWinProb1 * 100).toFixed(1)}% vs {(calcResult.expectedWinProb2 * 100).toFixed(1)}%
            </span>
          </div>

          {/* Probability Bar */}
          <div style={{ height: 10, width: '100%', background: '#e2e8f0', borderRadius: 999, overflow: 'hidden', display: 'flex', marginBottom: 14 }}>
            <div style={{ width: `${calcResult.expectedWinProb1 * 100}%`, background: '#059669', transition: 'width 0.4s' }} />
            <div style={{ width: `${calcResult.expectedWinProb2 * 100}%`, background: '#0284c7', transition: 'width 0.4s' }} />
          </div>

          {/* Quick Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 10, borderRadius: 10 }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Chênh Lệch DUPR (Diff)</div>
              <div className="mono" style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                {calcResult.ratingDiff > 0 ? `+${calcResult.ratingDiff.toFixed(3)}` : calcResult.ratingDiff.toFixed(3)}
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 10, borderRadius: 10 }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Hệ Số MOV (Cách biệt)</div>
              <div className="mono" style={{ fontSize: '0.95rem', fontWeight: 800, color: '#059669' }}>
                {calcResult.marginOfVictoryFactor.toFixed(2)}x
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 10, borderRadius: 10 }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Chia Điểm Thực Tế</div>
              <div className="mono" style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                {(calcResult.actualPointsShare1 * 100).toFixed(1)}% - {(calcResult.actualPointsShare2 * 100).toFixed(1)}%
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 10, borderRadius: 10 }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Hệ Số K Match Weight</div>
              <div className="mono" style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0284c7' }}>
                {importance === 'sanctioned' ? '0.18 (Giải)' : importance === 'league' ? '0.12 (CLB)' : '0.08 (Giao lưu)'}
              </div>
            </div>
          </div>

          {/* Analysis Note */}
          <div style={{ marginTop: 14, padding: '10px 14px', background: '#ecfdf5', borderRadius: 10, borderLeft: '3px solid #059669', fontSize: '0.82rem', color: '#064e3b', lineHeight: 1.5 }}>
            <span style={{ fontWeight: 800, color: '#059669' }}>💡 Phân tích DUPR: </span>
            {calcResult.analysisExplanation}
          </div>
        </div>
      </div>
    </div>
  );
};
