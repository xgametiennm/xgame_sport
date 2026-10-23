import React, { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { usePickleball } from '../context/PickleballContext';
import { MatchResult, Player } from '../types/pickleball';
import { Avatar, MobileCard, MobilePage, ScreenHeader } from './MobileUi';
import { playersWithRecordIn } from '../utils/playerStats';
import { parseRoundRobinNote, roundRobinEvents } from '../utils/roundRobin';

const RANK_MEDAL: Record<number, string> = { 1: '#f59e0b', 2: '#94a3b8', 3: '#c2703d' };
const COLUMNS = '24px minmax(0, 1fr) 34px 34px 34px 44px';

const teamName = (team: MatchResult['team1']) =>
  [team.player1, team.player2].filter((p): p is Player => !!p).map((p) => p.name).join(' & ');

/** Final ranking and round-by-round history of one saved round robin. */
export const RoundRobinResults: React.FC<{ code: string; onBack: () => void }> = ({ code, onBack }) => {
  const { matches, openPlayer } = usePickleball();
  const event = useMemo(() => roundRobinEvents(matches).find((e) => e.code === code), [matches, code]);

  const standings = useMemo(() => {
    if (!event) return [];
    // Participants come from the matches themselves, so members removed since still count
    const participants = new Map<string, Player>();
    event.matches.forEach((m) =>
      [m.team1.player1, m.team1.player2, m.team2.player1, m.team2.player2].forEach((p) => p && participants.set(p.id, p))
    );
    return playersWithRecordIn([...participants.values()], event.matches).sort((a, b) =>
      (b.winsDoubles - a.winsDoubles) ||
      (b.pointDifferential - a.pointDifferential) ||
      (a.matchesPlayedDoubles - b.matchesPlayedDoubles) ||
      a.name.localeCompare(b.name)
    );
  }, [event]);

  const rounds = useMemo(() => {
    const byRound = new Map<number, MatchResult[]>();
    event?.matches.forEach((m) => {
      const round = parseRoundRobinNote(m.notes)?.round ?? 0;
      byRound.set(round, [...(byRound.get(round) || []), m]);
    });
    return [...byRound.entries()].sort((a, b) => a[0] - b[0]);
  }, [event]);

  if (!event) {
    return (
      <MobilePage>
        <ScreenHeader title="Kết quả xoay cặp" onBack={onBack} />
        <MobileCard style={{ textAlign: 'center', padding: 24, fontSize: '0.84rem', color: '#64748b' }}>
          Chưa có trận nào của giải này được lưu.
        </MobileCard>
      </MobilePage>
    );
  }

  const headerCell: React.CSSProperties = { fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textAlign: 'center' };

  return (
    <MobilePage>
      <ScreenHeader title="Kết quả xoay cặp" onBack={onBack} />

      <MobileCard style={{ marginBottom: 12 }}>
        <div style={{ fontSize: '1.02rem', fontWeight: 900, color: '#0f172a' }}>{event.name}</div>
        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
          {new Date(event.date).toLocaleDateString('vi-VN')} · {event.matches.length} trận · {standings.length} người · {rounds.length} vòng
        </div>
      </MobileCard>

      {/* 1. FINAL RANKING */}
      <MobileCard style={{ padding: '8px 10px', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 2px 8px' }}>
          <Trophy size={16} color="#f59e0b" />
          <h2 style={{ fontSize: '0.9rem', fontWeight: 900, color: '#0f172a' }}>Bảng xếp hạng</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: COLUMNS, gap: 4, padding: '6px 2px', borderBottom: '1px solid #eef2f4' }}>
          <span style={headerCell}>#</span>
          <span style={{ ...headerCell, textAlign: 'left' }}>Thành viên</span>
          <span style={headerCell}>Trận</span>
          <span style={headerCell}>Thắng</span>
          <span style={headerCell}>Thua</span>
          <span style={headerCell}>Hiệu số</span>
        </div>
        {standings.map((p, index) => {
          const rank = index + 1;
          return (
            <div
              key={p.id}
              onClick={() => openPlayer(p)}
              style={{
                display: 'grid',
                gridTemplateColumns: COLUMNS,
                gap: 4,
                alignItems: 'center',
                padding: '7px 2px',
                borderBottom: rank === standings.length ? 'none' : '1px solid #f4f6f8',
                background: rank === 1 ? 'linear-gradient(90deg, #fef9c3, transparent)' : 'transparent',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 700,
                textAlign: 'center',
              }}
            >
              <span style={{ display: 'flex', justifyContent: 'center' }}>
                {rank <= 3 ? (
                  <span style={{ width: 22, height: 22, borderRadius: 7, background: RANK_MEDAL[rank], color: '#ffffff', fontSize: '0.74rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {rank}
                  </span>
                ) : (
                  <span style={{ color: '#64748b' }}>{rank}</span>
                )}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, textAlign: 'left' }}>
                <Avatar player={p} size={28} />
                <span style={{ color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
              </span>
              <span style={{ color: '#475569' }}>{p.matchesPlayedDoubles}</span>
              <span style={{ color: '#16a34a' }}>{p.winsDoubles}</span>
              <span style={{ color: '#dc2626' }}>{p.lossesDoubles}</span>
              <span style={{ color: p.pointDifferential > 0 ? '#16a34a' : p.pointDifferential < 0 ? '#dc2626' : '#64748b' }}>
                {p.pointDifferential > 0 ? `+${p.pointDifferential}` : p.pointDifferential}
              </span>
            </div>
          );
        })}
        <div style={{ fontSize: '0.64rem', color: '#94a3b8', padding: '8px 2px 2px' }}>
          Xếp theo số trận thắng, rồi hiệu số điểm.
        </div>
      </MobileCard>

      {/* 2. ROUND BY ROUND */}
      <h2 style={{ fontSize: '0.9rem', fontWeight: 900, color: '#0f172a', margin: '4px 2px 8px' }}>Lịch sử các vòng</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rounds.map(([round, list]) => (
          <MobileCard key={round} style={{ padding: '8px 12px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', marginBottom: 4 }}>VÒNG {round}</div>
            {list.map((m) => {
              const won1 = m.winner === 1;
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 0',
                    borderTop: '1px solid #f4f6f8',
                    fontSize: '0.74rem',
                  }}
                >
                  <span style={{ fontWeight: won1 ? 800 : 600, color: won1 ? '#047857' : '#334155', textAlign: 'right' }}>
                    {teamName(m.team1)}
                  </span>
                  <span className="mono" style={{ fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap' }}>
                    {m.totalScoreTeam1} - {m.totalScoreTeam2}
                  </span>
                  <span style={{ fontWeight: won1 ? 600 : 800, color: won1 ? '#334155' : '#047857' }}>
                    {teamName(m.team2)}
                  </span>
                </div>
              );
            })}
          </MobileCard>
        ))}
      </div>
    </MobilePage>
  );
};
