import React, { useState } from 'react';
import { usePickleball } from '../context/PickleballContext';
import { ScoringType } from '../types/pickleball';
import { 
  RotateCcw, 
  ArrowLeftRight, 
  Trophy, 
  Volume2, 
  VolumeX, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ScoreHistoryItem {
  score1: number;
  score2: number;
  serverNumber: 1 | 2;
  servingTeam: 1 | 2;
}

export const CourtsideScoreboard: React.FC = () => {
  const { lang, setActiveTab, selectedClub } = usePickleball();

  const [scoringType, setScoringType] = useState<ScoringType>('sideout');
  const [targetScore, setTargetScore] = useState<number>(11);
  const [team1Name] = useState<string>('Minh Quân / Thu Hương');
  const [team2Name] = useState<string>('Hoàng Long / Tuấn Anh');

  // Game state
  const [score1, setScore1] = useState<number>(0);
  const [score2, setScore2] = useState<number>(0);
  const [servingTeam, setServingTeam] = useState<1 | 2>(1);
  const [serverNumber, setServerNumber] = useState<1 | 2>(2);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Undo history stack
  const [history, setHistory] = useState<ScoreHistoryItem[]>([]);

  const isGameOver = (score1 >= targetScore || score2 >= targetScore) && Math.abs(score1 - score2) >= 2;
  const isGamePoint = !isGameOver && ((score1 >= targetScore - 1 && score1 > score2) || (score2 >= targetScore - 1 && score2 > score1));

  // Audio beep simulation
  const playBeep = (freq = 440, duration = 0.1) => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch {
      // AudioContext
    }
  };

  const pushState = () => {
    setHistory((prev) => [
      ...prev,
      { score1, score2, serverNumber, servingTeam },
    ]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setScore1(last.score1);
    setScore2(last.score2);
    setServerNumber(last.serverNumber);
    setServingTeam(last.servingTeam);
    setHistory((prev) => prev.slice(0, prev.length - 1));
  };

  const handlePointTeam1 = () => {
    if (isGameOver) return;
    pushState();

    if (scoringType === 'rally') {
      const nextScore = score1 + 1;
      setScore1(nextScore);
      setServingTeam(1);
      playBeep(520, 0.12);
      checkWin(nextScore, score2);
    } else {
      if (servingTeam === 1) {
        const nextScore = score1 + 1;
        setScore1(nextScore);
        playBeep(580, 0.15);
        checkWin(nextScore, score2);
      } else {
        handleSideOut();
      }
    }
  };

  const handlePointTeam2 = () => {
    if (isGameOver) return;
    pushState();

    if (scoringType === 'rally') {
      const nextScore = score2 + 1;
      setScore2(nextScore);
      setServingTeam(2);
      playBeep(480, 0.12);
      checkWin(score1, nextScore);
    } else {
      if (servingTeam === 2) {
        const nextScore = score2 + 1;
        setScore2(nextScore);
        playBeep(580, 0.15);
        checkWin(score1, nextScore);
      } else {
        handleSideOut();
      }
    }
  };

  const handleSideOut = () => {
    playBeep(320, 0.15);
    if (serverNumber === 1) {
      setServerNumber(2);
    } else {
      setServerNumber(1);
      setServingTeam(servingTeam === 1 ? 2 : 1);
    }
  };

  const checkWin = (s1: number, s2: number) => {
    if ((s1 >= targetScore || s2 >= targetScore) && Math.abs(s1 - s2) >= 2) {
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#059669', '#84cc16', '#0284c7', '#f59e0b'],
        });
      } catch {
        // ignore
      }
    }
  };

  const resetGame = () => {
    setScore1(0);
    setScore2(0);
    setServingTeam(1);
    setServerNumber(2);
    setHistory([]);
  };

  const getCallString = () => {
    if (scoringType === 'rally') {
      return `${score1} — ${score2}`;
    }
    const serverScore = servingTeam === 1 ? score1 : score2;
    const receiverScore = servingTeam === 1 ? score2 : score1;
    return `${serverScore} - ${receiverScore} - ${serverNumber}`;
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px' }}>
      {/* Top Header Controls (Light Card) */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-court">COURTSIDE LIVE</span>
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>{selectedClub.name}</span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginTop: 4, color: '#0f172a' }}>
              {lang === 'vi' ? 'Bảng Điểm Trực Tiếp Trên Sân' : 'Courtside Live Scoreboard'}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Audio Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="btn-secondary"
              style={{ padding: '8px 12px' }}
              title="Âm thanh tiếng bíp"
            >
              {soundEnabled ? <Volume2 size={16} color="#059669" /> : <VolumeX size={16} color="#94a3b8" />}
            </button>

            {/* Target Score */}
            <select
              value={targetScore}
              onChange={(e) => setTargetScore(parseInt(e.target.value))}
              className="input-dark"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
            >
              <option value="11">Chạm 11 điểm (Tiêu chuẩn)</option>
              <option value="15">Chạm 15 điểm</option>
              <option value="21">Chạm 21 điểm (Rally)</option>
            </select>

            {/* Scoring Type */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 999, border: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setScoringType('sideout')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: scoringType === 'sideout' ? '#0d5e46' : 'transparent',
                  color: scoringType === 'sideout' ? '#ffffff' : '#64748b',
                }}
              >
                Side-Out (Chuẩn)
              </button>
              <button
                onClick={() => setScoringType('rally')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: scoringType === 'rally' ? '#0d5e46' : 'transparent',
                  color: scoringType === 'rally' ? '#ffffff' : '#64748b',
                }}
              >
                Rally Scoring
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CALL SCORE DISPLAY BANNER (Athletic Forest Green) */}
      <div style={{
        background: isGameOver 
          ? 'linear-gradient(135deg, #065f46, #047857)' 
          : 'linear-gradient(135deg, #064030, #0a543e)',
        borderRadius: 20,
        padding: '16px 24px',
        marginBottom: 20,
        border: '1px solid rgba(255, 255, 255, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        color: '#ffffff',
        boxShadow: 'var(--shadow-court)',
      }}>
        <div>
          <div style={{ fontSize: '0.78rem', color: '#a7f3d0', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {lang === 'vi' ? 'TIẾNG HÔ ĐIỂM CHUẨN (CALL SCORE):' : 'OFFICIAL REFEREE CALL:'}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '2.4rem',
            fontWeight: 900,
            color: '#bef264',
            letterSpacing: '0.04em',
            lineHeight: 1.1,
          }}>
            {getCallString()}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
            {scoringType === 'sideout' ? (
              <span>Đội đang giao bóng: <strong>Đội {servingTeam}</strong> (Lượt người giao thứ {serverNumber})</span>
            ) : (
              <span>Giao bóng: Đội {servingTeam}</span>
            )}
          </div>
        </div>

        {/* Game Status Badge */}
        <div>
          {isGameOver ? (
            <div style={{
              background: '#ffffff',
              color: '#064e3b',
              padding: '10px 20px',
              borderRadius: 14,
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: '1.2rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
            }}>
              <Trophy size={22} color="#059669" />
              <span>{score1 > score2 ? team1Name : team2Name} CHIẾN THẮNG!</span>
            </div>
          ) : isGamePoint ? (
            <div style={{
              background: '#e11d48',
              color: '#ffffff',
              padding: '8px 16px',
              borderRadius: 12,
              fontWeight: 800,
              fontSize: '1rem',
            }}>
              🔥 GAME POINT!
            </div>
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.12)',
              padding: '8px 16px',
              borderRadius: 12,
              fontSize: '0.85rem',
              color: '#ffffff',
            }}>
              Cách biệt tối thiểu 2 điểm
            </div>
          )}
        </div>
      </div>

      {/* MASSIVE TOUCH SCOREBOARD GRID (Light Mode) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
        marginBottom: 20,
      }}>
        {/* TEAM 1 SIDE */}
        <div style={{
          background: servingTeam === 1 ? '#ecfdf5' : '#ffffff',
          border: servingTeam === 1 ? '3px solid #059669' : '1px solid #e2e8f0',
          borderRadius: 24,
          padding: '24px 20px',
          textAlign: 'center',
          boxShadow: servingTeam === 1 ? '0 8px 24px rgba(5, 150, 105, 0.15)' : 'var(--shadow-sm)',
          position: 'relative',
          transition: 'all 0.3s ease',
        }}>
          {/* Serving Pill */}
          {servingTeam === 1 && (
            <div style={{
              position: 'absolute',
              top: 14,
              right: 14,
              background: '#059669',
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: '0.72rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <span>🎾 GIAO BÓNG (#{serverNumber})</span>
            </div>
          )}

          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>
            {team1Name}
          </div>

          {/* Big Score Number */}
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '5.5rem',
            fontWeight: 900,
            lineHeight: 1,
            color: '#064e3b',
            margin: '16px 0',
          }}>
            {score1}
          </div>

          {/* Huge Touch Button */}
          <button
            onClick={handlePointTeam1}
            disabled={isGameOver}
            className="btn-court"
            style={{
              width: '100%',
              padding: '18px 24px',
              fontSize: '1.25rem',
              fontWeight: 900,
              borderRadius: 18,
              opacity: isGameOver ? 0.4 : 1,
            }}
          >
            +1 ĐIỂM
          </button>
        </div>

        {/* TEAM 2 SIDE */}
        <div style={{
          background: servingTeam === 2 ? '#f0f9ff' : '#ffffff',
          border: servingTeam === 2 ? '3px solid #0284c7' : '1px solid #e2e8f0',
          borderRadius: 24,
          padding: '24px 20px',
          textAlign: 'center',
          boxShadow: servingTeam === 2 ? '0 8px 24px rgba(2, 132, 199, 0.15)' : 'var(--shadow-sm)',
          position: 'relative',
          transition: 'all 0.3s ease',
        }}>
          {/* Serving Pill */}
          {servingTeam === 2 && (
            <div style={{
              position: 'absolute',
              top: 14,
              right: 14,
              background: '#0284c7',
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: '0.72rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <span>🎾 GIAO BÓNG (#{serverNumber})</span>
            </div>
          )}

          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>
            {team2Name}
          </div>

          {/* Big Score Number */}
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '5.5rem',
            fontWeight: 900,
            lineHeight: 1,
            color: '#0369a1',
            margin: '16px 0',
          }}>
            {score2}
          </div>

          {/* Huge Touch Button */}
          <button
            onClick={handlePointTeam2}
            disabled={isGameOver}
            style={{
              width: '100%',
              padding: '18px 24px',
              fontSize: '1.25rem',
              fontWeight: 900,
              borderRadius: 18,
              border: 'none',
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              color: '#ffffff',
              cursor: isGameOver ? 'default' : 'pointer',
              opacity: isGameOver ? 0.4 : 1,
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.25)',
            }}
          >
            +1 ĐIỂM
          </button>
        </div>
      </div>

      {/* Courtside Actions bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {scoringType === 'sideout' && (
          <button
            onClick={handleSideOut}
            disabled={isGameOver}
            className="btn-secondary"
            style={{ padding: '12px 20px', fontSize: '0.95rem' }}
          >
            <ArrowLeftRight size={17} />
            <span>Đổi Lượt Giao Bóng (Side Out)</span>
          </button>
        )}

        <button
          onClick={handleUndo}
          disabled={history.length === 0}
          className="btn-secondary"
          style={{ padding: '12px 20px', fontSize: '0.95rem', opacity: history.length === 0 ? 0.4 : 1 }}
        >
          <RotateCcw size={17} />
          <span>Hoàn Tác Điểm Vừa Bấm ({history.length})</span>
        </button>

        <button
          onClick={resetGame}
          className="btn-secondary"
          style={{ padding: '12px 20px', fontSize: '0.95rem', color: '#e11d48' }}
        >
          <span>Làm Mới (Reset Sân)</span>
        </button>

        {/* If game over -> Button to calculate DUPR */}
        {isGameOver && (
          <button
            onClick={() => setActiveTab('calculator')}
            className="btn-primary"
            style={{ padding: '12px 24px', fontSize: '1rem' }}
          >
            <Sparkles size={18} />
            <span>Tính Điểm DUPR Với Tỷ Số Này ({score1} - {score2})</span>
            <ArrowRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
};
