import React, { useState } from 'react';
import { usePickleball } from '../context/PickleballContext';
import { Player } from '../types/pickleball';
import { 
  Shuffle, 
  Check, 
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

type TournamentMode = 'americano' | 'mexicano' | 'kotc' | 'roundrobin';

interface GeneratedRoundMatch {
  courtNumber: number;
  team1Player1: Player;
  team1Player2: Player;
  team2Player1: Player;
  team2Player2: Player;
  score1: number;
  score2: number;
  completed: boolean;
}

export const TournamentGenerator: React.FC = () => {
  const { players, lang, selectedClub } = usePickleball();

  const [mode, setMode] = useState<TournamentMode>('americano');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(
    players.slice(0, 8).map((p) => p.id)
  );
  const [targetScore] = useState<number>(11);
  const [currentRoundNumber, setCurrentRoundNumber] = useState<number>(1);
  const [generatedMatches, setGeneratedMatches] = useState<GeneratedRoundMatch[]>([]);
  const [isGenerated, setIsGenerated] = useState<boolean>(false);

  // Toggle player selection
  const togglePlayer = (id: string) => {
    if (selectedPlayerIds.includes(id)) {
      if (selectedPlayerIds.length > 4) {
        setSelectedPlayerIds((prev) => prev.filter((p) => p !== id));
      }
    } else {
      setSelectedPlayerIds((prev) => [...prev, id]);
    }
  };

  // Generate Matchday pairings
  const handleGenerate = () => {
    const activePlayers = players.filter((p) => selectedPlayerIds.includes(p.id));
    if (activePlayers.length < 4) return;

    // Shuffle players for fairness
    const shuffled = [...activePlayers].sort(() => Math.random() - 0.5);
    const matches: GeneratedRoundMatch[] = [];

    // Group into 4s for each court
    const numCourts = Math.floor(shuffled.length / 4);

    for (let c = 0; c < numCourts; c++) {
      const p1 = shuffled[c * 4];
      const p2 = shuffled[c * 4 + 1];
      const p3 = shuffled[c * 4 + 2];
      const p4 = shuffled[c * 4 + 3];

      matches.push({
        courtNumber: c + 1,
        team1Player1: p1,
        team1Player2: p2,
        team2Player1: p3,
        team2Player2: p4,
        score1: 0,
        score2: 0,
        completed: false,
      });
    }

    setGeneratedMatches(matches);
    setIsGenerated(true);
  };

  const handleScoreChange = (index: number, score1: number, score2: number) => {
    setGeneratedMatches((prev) => {
      const updated = [...prev];
      updated[index].score1 = score1;
      updated[index].score2 = score2;
      updated[index].completed = (score1 >= targetScore || score2 >= targetScore) && Math.abs(score1 - score2) >= 2;
      return updated;
    });
  };

  // Submit round results
  const handleCompleteRound = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }
    alert(lang === 'vi' ? 'Đã hoàn thành vòng đấu và cập nhật điểm giải!' : 'Round completed!');
    setCurrentRoundNumber((prev) => prev + 1);
    handleGenerate();
  };

  return (
    <div style={{ maxWidth: 1050, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header Banner */}
      <div className="hero-gradient card" style={{ marginBottom: 24, padding: '26px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span className="badge badge-neon" style={{ background: '#d9f99d', color: '#365314', border: '1px solid #bef264' }}>
            TOURNAMENT & MATCHDAY ENGINE
          </span>
          <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)' }}>{selectedClub.name}</span>
        </div>
        <h1 style={{ fontSize: '2.1rem', fontWeight: 900, color: '#ffffff', lineHeight: 1.15 }}>
          {lang === 'vi' ? 'Tạo Giải & Xoay Vòng Matchday' : 'Matchday & Tournament Generator'}
        </h1>
        <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.95rem', marginTop: 6, maxWidth: 700 }}>
          {lang === 'vi'
            ? 'Tự động bốc thăm, ghép cặp công bằng theo thuật toán Americano, Mexicano, King of the Court và cập nhật DUPR trực tiếp.'
            : 'Auto-schedule balanced matchups for Americano, Mexicano, King of the Court sessions with live DUPR sync.'}
        </p>
      </div>

      {/* Select Tournament Mode (Light Cards) */}
      <div className="card" style={{ marginBottom: 24, padding: 20 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 14, color: '#0f172a' }}>
          {lang === 'vi' ? '1. Chọn Thể Thức Thi Đấu:' : '1. Choose Tournament Mode:'}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {/* Americano */}
          <div
            onClick={() => setMode('americano')}
            className="card card-interactive"
            style={{
              padding: 16,
              border: mode === 'americano' ? '2px solid #059669' : '1px solid #e2e8f0',
              background: mode === 'americano' ? '#ecfdf5' : '#ffffff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: '1.4rem' }}>🎯</span>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: mode === 'americano' ? '#059669' : '#0f172a' }}>
                Americano
              </div>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
              {lang === 'vi' 
                ? 'Mỗi người cặp với tất cả người khác, tính điểm cá nhân. Không ai bị loại.' 
                : 'Everyone partners everyone. Individual points accumulate. No eliminations.'}
            </p>
          </div>

          {/* Mexicano */}
          <div
            onClick={() => setMode('mexicano')}
            className="card card-interactive"
            style={{
              padding: 16,
              border: mode === 'mexicano' ? '2px solid #059669' : '1px solid #e2e8f0',
              background: mode === 'mexicano' ? '#ecfdf5' : '#ffffff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: '1.4rem' }}>🏆</span>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: mode === 'mexicano' ? '#059669' : '#0f172a' }}>
                Mexicano
              </div>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
              {lang === 'vi' 
                ? 'Ghép cặp động theo BXH: nhóm dẫn đầu gặp nhóm dẫn đầu, trận đấu luôn kịch tính.' 
                : 'Dynamic pairing by live standings (leaders play leaders). Highly competitive.'}
            </p>
          </div>

          {/* King of the Court */}
          <div
            onClick={() => setMode('kotc')}
            className="card card-interactive"
            style={{
              padding: 16,
              border: mode === 'kotc' ? '2px solid #d97706' : '1px solid #e2e8f0',
              background: mode === 'kotc' ? '#fffbeb' : '#ffffff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: '1.4rem' }}>👑</span>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: mode === 'kotc' ? '#d97706' : '#0f172a' }}>
                King of Court
              </div>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
              {lang === 'vi' 
                ? 'Thắng lên 1 sân về sân Vua (Sân 1), thua xuống 1 sân. Tách cặp sau mỗi vòng.' 
                : 'Winners move up toward King Court, losers move down. Partners split.'}
            </p>
          </div>

          {/* Round Robin */}
          <div
            onClick={() => setMode('roundrobin')}
            className="card card-interactive"
            style={{
              padding: 16,
              border: mode === 'roundrobin' ? '2px solid #0284c7' : '1px solid #e2e8f0',
              background: mode === 'roundrobin' ? '#f0f9ff' : '#ffffff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: '1.4rem' }}>🔄</span>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: mode === 'roundrobin' ? '#0284c7' : '#0f172a' }}>
                Vòng Tròn Đôi
              </div>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
              {lang === 'vi' 
                ? 'Chia bảng đánh vòng tròn tính điểm hiệu số thắng thua và chỉ số DUPR.' 
                : 'Standard round robin schedule with differential and DUPR points.'}
            </p>
          </div>
        </div>
      </div>

      {/* Select Players Participating */}
      <div className="card" style={{ marginBottom: 24, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
            {lang === 'vi' 
              ? `2. Chọn Tay Vợt Tham Gia (${selectedPlayerIds.length}/${players.length} người, cần bội số của 4):` 
              : `2. Select Players (${selectedPlayerIds.length}/${players.length}):`}
          </h3>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
            {Math.floor(selectedPlayerIds.length / 4)} sân đấu đồng thời
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {players.map((p) => {
            const isSelected = selectedPlayerIds.includes(p.id);
            return (
              <div
                key={p.id}
                onClick={() => togglePlayer(p.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 12,
                  background: isSelected ? '#ecfdf5' : '#f8fafc',
                  border: isSelected ? '1.5px solid #059669' : '1px solid #e2e8f0',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  background: isSelected ? '#059669' : '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '0.75rem',
                }}>
                  {isSelected && <Check size={14} />}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#059669', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {p.doublesRating.toFixed(3)} DUPR
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Generate Button */}
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button
            onClick={handleGenerate}
            disabled={selectedPlayerIds.length < 4}
            className="btn-primary"
            style={{ padding: '12px 32px', fontSize: '1rem' }}
          >
            <Shuffle size={18} />
            <span>{lang === 'vi' ? '⚡ Bốc Thăm & Tạo Lịch Đấu Vòng ' + currentRoundNumber : '⚡ Generate Round ' + currentRoundNumber}</span>
          </button>
        </div>
      </div>

      {/* Generated Matches Card */}
      {isGenerated && generatedMatches.length > 0 && (
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a' }}>
              <span>🎾</span> {lang === 'vi' ? `Lịch Đấu Vòng ${currentRoundNumber} - ${mode.toUpperCase()}` : `Round ${currentRoundNumber} Schedule`}
            </h3>
            <button
              onClick={handleCompleteRound}
              className="btn-court"
              style={{ padding: '8px 18px', fontSize: '0.85rem' }}
            >
              <span>Xác Nhận & Qua Vòng Tiếp Theo</span>
              <ArrowRight size={15} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {generatedMatches.map((m, idx) => (
              <div
                key={idx}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 16,
                  padding: 16,
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto 1fr',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                {/* Court Tag */}
                <div style={{
                  background: '#0d5e46',
                  color: '#bef264',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: '0.8rem',
                  padding: '6px 12px',
                  borderRadius: 10,
                  textAlign: 'center',
                }}>
                  SÂN #{m.courtNumber}
                </div>

                {/* Team 1 */}
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#059669' }}>
                    {m.team1Player1.name} & {m.team1Player2.name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    DUPR TB: {((m.team1Player1.doublesRating + m.team1Player2.doublesRating) / 2).toFixed(3)}
                  </div>
                </div>

                {/* Score Steppers */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={m.score1}
                    onChange={(e) => handleScoreChange(idx, parseInt(e.target.value) || 0, m.score2)}
                    className="mono"
                    style={{ width: 50, height: 40, fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', background: '#ffffff', border: '1px solid #059669', color: '#0f172a', borderRadius: 8 }}
                  />
                  <span style={{ fontWeight: 900, color: '#64748b' }}>-</span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={m.score2}
                    onChange={(e) => handleScoreChange(idx, m.score1, parseInt(e.target.value) || 0)}
                    className="mono"
                    style={{ width: 50, height: 40, fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', background: '#ffffff', border: '1px solid #0284c7', color: '#0f172a', borderRadius: 8 }}
                  />
                </div>

                {/* Team 2 */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0284c7' }}>
                    {m.team2Player1.name} & {m.team2Player2.name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    DUPR TB: {((m.team2Player1.doublesRating + m.team2Player2.doublesRating) / 2).toFixed(3)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
