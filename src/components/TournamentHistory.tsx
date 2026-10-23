import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Repeat, Trash2, Trophy } from 'lucide-react';
import { usePickleball } from '../context/PickleballContext';
import { api } from '../services/api';
import { TournamentData, TournamentMatch, TournamentTeam } from '../types/pickleball';
import { calculateGroupStandings } from '../utils/tournamentEngine';
import { playersWithRecordIn } from '../utils/playerStats';
import { roundRobinEvents } from '../utils/roundRobin';
import { RoundRobinResults } from './RoundRobinResults';

interface SavedTournament {
  tournament: TournamentData;
  finishedAt: string;
}

// One row of the list: a bracket/group tournament, or a round robin played in the Play tab
type PastEvent =
  | { kind: 'tournament'; key: string; name: string; date: string; detail: string; winner: string; saved: SavedTournament }
  | { kind: 'roundRobin'; key: string; name: string; date: string; detail: string; winner: string; code: string };

const TYPE_LABEL: Record<TournamentData['type'], string> = {
  group_and_knockout: 'Vòng bảng + Loại trực tiếp',
  knockout_only: 'Loại trực tiếp',
  group_only: 'Vòng bảng',
};

const teamLabel = (team?: TournamentTeam | null) =>
  team ? [team.player1?.name, team.player2?.name].filter(Boolean).join(' & ') || team.name : '—';

const formatDate = (value: string) => new Date(value).toLocaleDateString('vi-VN');

/** List of the club's finished tournaments and round robins, each opening its results. */
export const TournamentHistory: React.FC = () => {
  const { selectedClub, matches, isManager } = usePickleball();
  const [saved, setSaved] = useState<SavedTournament[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getTournamentHistory(selectedClub.id)
      .then((list) => !cancelled && setSaved(list))
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : 'Không tải được danh sách giải'));
    return () => {
      cancelled = true;
    };
  }, [selectedClub.id]);

  const events = useMemo<PastEvent[]>(() => {
    const tournaments: PastEvent[] = (saved || []).map((s) => ({
      kind: 'tournament',
      key: `t:${s.tournament.id}`,
      name: s.tournament.name,
      date: s.finishedAt,
      detail: `${s.tournament.format === 'doubles' ? 'Đôi' : 'Đơn'} · ${TYPE_LABEL[s.tournament.type]} · ${s.tournament.teams.length} đội`,
      winner: teamLabel(s.tournament.champion),
      saved: s,
    }));
    const roundRobins: PastEvent[] = roundRobinEvents(matches).map((e) => {
      const [first] = playersWithRecordIn(
        [...new Map(e.matches.flatMap((m) => [m.team1.player1, m.team1.player2, m.team2.player1, m.team2.player2])
          .filter((p): p is NonNullable<typeof p> => !!p).map((p) => [p.id, p])).values()],
        e.matches
      ).sort((a, b) => (b.winsDoubles - a.winsDoubles) || (b.pointDifferential - a.pointDifferential));
      return {
        kind: 'roundRobin',
        key: `rr:${e.code}`,
        name: e.name,
        date: e.date,
        detail: `Xoay cặp · ${e.matches.length} trận`,
        winner: first ? first.name : '—',
        code: e.code,
      };
    });
    return [...tournaments, ...roundRobins].sort((a, b) => b.date.localeCompare(a.date));
  }, [saved, matches]);

  const open = events.find((e) => e.key === openKey);
  if (open?.kind === 'roundRobin') return <RoundRobinResults code={open.code} onBack={() => setOpenKey(null)} />;
  if (open?.kind === 'tournament') return <TournamentResults saved={open.saved} onBack={() => setOpenKey(null)} />;

  const handleDelete = async (s: SavedTournament) => {
    if (!window.confirm(`Xóa "${s.tournament.name}" khỏi danh sách giải đã thi đấu?`)) return;
    try {
      await api.deleteTournamentHistory(selectedClub.id, s.tournament.id);
      setSaved((list) => (list || []).filter((x) => x.tournament.id !== s.tournament.id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Không xóa được giải');
    }
  };

  return (
    <div className="card" style={{ padding: 18, borderRadius: 20 }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Trophy size={20} color="#f59e0b" /> Giải đã thi đấu
      </h2>
      <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 12 }}>
        Các giải đã kết thúc của CLB và giải xoay cặp ở phần Chơi. Bấm vào một giải để xem bảng xếp hạng và kết quả.
      </p>

      {saved === null && !loadError && <div style={{ padding: 16, color: '#64748b', fontSize: '0.85rem' }}>Đang tải...</div>}
      {loadError && <div style={{ padding: 16, color: '#b91c1c', fontSize: '0.85rem' }}>{loadError}</div>}
      {saved !== null && events.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: '0.86rem' }}>
          Chưa có giải nào kết thúc.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {events.map((e) => (
          <div
            key={e.key}
            onClick={() => setOpenKey(e.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: e.kind === 'tournament' ? '#fef3c7' : '#f3e8ff',
            }}>
              {e.kind === 'tournament' ? <Trophy size={20} color="#d97706" /> : <Repeat size={20} color="#9333ea" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {e.name}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{formatDate(e.date)} · {e.detail}</div>
              <div style={{ fontSize: '0.76rem', color: '#b45309', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                🏆 {e.winner}
              </div>
            </div>
            {isManager && e.kind === 'tournament' && (
              <button
                onClick={(ev) => {
                  ev.stopPropagation();
                  handleDelete(e.saved);
                }}
                title="Xóa khỏi danh sách"
                aria-label={`Xóa ${e.name}`}
                style={{ border: 'none', background: '#fef2f2', color: '#dc2626', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}
              >
                <Trash2 size={15} />
              </button>
            )}
            <ChevronRight size={18} color="#94a3b8" />
          </div>
        ))}
      </div>
    </div>
  );
};

const MatchRow: React.FC<{ match: TournamentMatch }> = ({ match }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
    gap: 10,
    alignItems: 'center',
    padding: '7px 0',
    borderTop: '1px solid #f1f5f9',
    fontSize: '0.8rem',
  }}>
    <span style={{ textAlign: 'right', fontWeight: match.winner === 1 ? 800 : 600, color: match.winner === 1 ? '#047857' : '#334155' }}>
      {teamLabel(match.team1)}
    </span>
    <span className="mono" style={{ fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap' }}>
      {match.completed ? `${match.score1 ?? 0} - ${match.score2 ?? 0}` : 'chưa đấu'}
    </span>
    <span style={{ fontWeight: match.winner === 2 ? 800 : 600, color: match.winner === 2 ? '#047857' : '#334155' }}>
      {teamLabel(match.team2)}
    </span>
  </div>
);

/** Podium, group tables and every match of one finished tournament. */
const TournamentResults: React.FC<{ saved: SavedTournament; onBack: () => void }> = ({ saved, onBack }) => {
  const t = saved.tournament;
  const standings = useMemo(
    () => (t.groupMatches.length > 0 ? calculateGroupStandings(t.teams, t.groupMatches) : {}),
    [t]
  );

  const byLabel = (list: TournamentMatch[], label: (m: TournamentMatch) => string) => {
    const groups = new Map<string, TournamentMatch[]>();
    list.forEach((m) => groups.set(label(m), [...(groups.get(label(m)) || []), m]));
    return [...groups.entries()];
  };
  const groupRounds = byLabel(t.groupMatches, (m) => m.groupName || 'Vòng bảng');
  const knockoutRounds = byLabel(
    [...t.knockoutMatches].sort((a, b) => a.roundIndex - b.roundIndex || a.matchIndex - b.matchIndex),
    (m) => m.roundName
  );

  const podium = [
    { label: '🥇 Vô địch', team: t.champion, color: '#b45309', bg: '#fef3c7' },
    { label: '🥈 Á quân', team: t.runnerUp, color: '#475569', bg: '#f1f5f9' },
    { label: '🥉 Hạng ba', team: t.thirdPlace, color: '#9a3412', bg: '#ffedd5' },
  ].filter((p) => p.team);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <button
        onClick={onBack}
        style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', color: '#475569', fontWeight: 700, cursor: 'pointer', padding: 0 }}
      >
        <ChevronLeft size={18} /> Danh sách giải
      </button>

      <div className="card" style={{ padding: 18, borderRadius: 20 }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>{t.name}</h2>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
          Kết thúc {formatDate(saved.finishedAt)} · {t.format === 'doubles' ? 'Đôi' : 'Đơn'} · {TYPE_LABEL[t.type]} · {t.teams.length} đội
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 14 }}>
          {podium.map((p) => (
            <div key={p.label} style={{ background: p.bg, borderRadius: 14, padding: '10px 12px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: p.color }}>{p.label}</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#0f172a' }}>{teamLabel(p.team)}</div>
            </div>
          ))}
        </div>
      </div>

      {Object.entries(standings).map(([group, rows]) => (
        <div key={group} className="card" style={{ padding: 16, borderRadius: 20, overflowX: 'auto' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>Bảng xếp hạng {group}</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ color: '#64748b', textAlign: 'center' }}>
                <th style={{ padding: 6 }}>#</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Đội</th>
                <th style={{ padding: 6 }}>Trận</th>
                <th style={{ padding: 6 }}>Thắng</th>
                <th style={{ padding: 6 }}>Thua</th>
                <th style={{ padding: 6 }}>Hiệu số</th>
                <th style={{ padding: 6 }}>Điểm</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.team.id} style={{ borderTop: '1px solid #f1f5f9', textAlign: 'center', fontWeight: 700 }}>
                  <td style={{ padding: 6, color: '#64748b' }}>{r.rank}</td>
                  <td style={{ padding: 6, textAlign: 'left', color: '#0f172a' }}>{teamLabel(r.team)}</td>
                  <td style={{ padding: 6 }}>{r.played}</td>
                  <td style={{ padding: 6, color: '#16a34a' }}>{r.won}</td>
                  <td style={{ padding: 6, color: '#dc2626' }}>{r.lost}</td>
                  <td style={{ padding: 6 }}>{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                  <td style={{ padding: 6, color: '#0f172a' }}>{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {[...knockoutRounds, ...groupRounds].length > 0 && (
        <div className="card" style={{ padding: 16, borderRadius: 20 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>Kết quả các trận</h3>
          {[...knockoutRounds.reverse(), ...groupRounds].map(([label, list]) => (
            <div key={label} style={{ marginTop: 10 }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>{label}</div>
              {list.map((m) => <MatchRow key={m.id} match={m} />)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
