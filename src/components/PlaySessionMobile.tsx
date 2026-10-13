import React, { useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { usePickleball } from '../context/PickleballContext';
import { Player } from '../types/pickleball';
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  Handshake,
  Lightbulb,
  Shuffle,
  ListOrdered,
  MapPin,
  Pencil,
  Plus,
  Square,
  Trash2,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { Avatar, MobileCard, MobilePage, PillToggle, PrimaryButton, ScreenHeader } from './MobileUi';
import { buildMatchResult } from '../utils/buildMatchResult';
import {
  appendMatches,
  busyAtSameTime,
  fillMatch,
  hasResult,
  isLineupComplete,
  isManualPairing,
  PlaySession,
  scheduledCounts,
  SessionMatch,
} from '../utils/playSession';

interface PlaySessionMobileProps {
  session: PlaySession;
  onChange: (update: (session: PlaySession) => PlaySession) => void;
  onEnd: () => void;
}

type SessionTab = 'matches' | 'stats' | 'members';
type TeamKey = 'team1' | 'team2';

const MAX_SCORE = 30;

const iconButtonStyle = (background: string, color: string): React.CSSProperties => ({
  width: 30,
  height: 30,
  borderRadius: 9,
  border: 'none',
  background,
  color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
});

const SummaryCell: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string }> = ({
  icon,
  label,
  value,
  sub,
}) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, minWidth: 0 }}>
    <div style={{ color: '#059669', display: 'flex', flexShrink: 0, marginTop: 2 }}>{icon}</div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.62rem', color: '#64748b' }}>{sub}</div>}
    </div>
  </div>
);

const PlayerSlot: React.FC<{ player?: Player; editable: boolean; onPick: () => void }> = ({ player, editable, onPick }) => (
  <button
    type="button"
    onClick={onPick}
    disabled={!editable && !!player}
    style={{
      width: 52,
      background: 'transparent',
      border: 'none',
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 3,
      cursor: editable || !player ? 'pointer' : 'default',
    }}
  >
    {player ? (
      <Avatar player={player} size={40} ring={editable ? '#10b981' : '#e2e8f0'} />
    ) : (
      <span style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: '1.5px dashed #cbd5e1',
        color: '#94a3b8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Plus size={18} />
      </span>
    )}
    <span style={{
      width: '100%',
      fontSize: '0.62rem',
      fontWeight: 600,
      lineHeight: 1.2,
      color: player ? '#334155' : '#94a3b8',
      textAlign: 'center',
    }}>
      {player ? player.name : 'Chọn'}
    </span>
  </button>
);

const ScoreStepper: React.FC<{ value: number | null; winning: boolean; onChange: (v: number | null) => void }> = ({
  value,
  winning,
  onChange,
}) => {
  const arrowStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    padding: 0,
    display: 'flex',
    cursor: 'pointer',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <button
        type="button"
        aria-label="Tăng điểm"
        onClick={() => onChange(Math.min(MAX_SCORE, (value ?? -1) + 1))}
        style={arrowStyle}
      >
        <ChevronUp size={18} />
      </button>
      <input
        inputMode="numeric"
        value={value ?? ''}
        placeholder="-"
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          onChange(digits === '' ? null : Math.min(MAX_SCORE, parseInt(digits, 10)));
        }}
        style={{
          width: 34,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          textAlign: 'center',
          fontFamily: 'var(--font-display)',
          fontSize: '1.2rem',
          fontWeight: 900,
          color: winning ? '#059669' : '#0f172a',
          padding: 0,
        }}
      />
      <button
        type="button"
        aria-label="Giảm điểm"
        onClick={() => onChange(value === null ? 0 : Math.max(0, value - 1))}
        style={arrowStyle}
      >
        <ChevronDown size={18} />
      </button>
    </div>
  );
};

export const PlaySessionMobile: React.FC<PlaySessionMobileProps> = ({ session, onChange, onEnd }) => {
  const { players, selectedClub, setActiveTab, recordNewMatch } = usePickleball();
  const [tab, setTab] = useState<SessionTab>('matches');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [picker, setPicker] = useState<{ matchId: string; team: TeamKey; index: number } | null>(null);

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const members = session.memberIds.map((id) => playerById.get(id)).filter((p): p is Player => !!p);

  const { matches } = session;
  const perTeam = session.format === 'doubles' ? 2 : 1;
  const manual = isManualPairing(session);
  const dateLabel = new Date(`${session.date}T00:00`).toLocaleDateString('vi-VN');
  const courtsLabel = Array.from({ length: session.courts }, (_, i) => i + 1).join(', ');

  const updateMatches = (fn: (current: PlaySession) => SessionMatch[]) =>
    onChange((current) => ({ ...current, matches: fn(current) }));
  const patchMatch = (id: string, patch: Partial<SessionMatch>) =>
    updateMatches((current) => current.matches.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const assignSlot = (playerId: string | null) => {
    if (!picker) return;
    const match = matches.find((m) => m.id === picker.matchId);
    if (!match) {
      setPicker(null);
      return;
    }
    const lineup = { team1: [...match.team1], team2: [...match.team2] };
    lineup[picker.team][picker.index] = playerId;
    patchMatch(match.id, lineup);

    // Building a match by hand: move straight on to its next empty position
    const slots: { team: TeamKey; index: number }[] = [
      ...lineup.team1.map((_, index) => ({ team: 'team1' as const, index })),
      ...lineup.team2.map((_, index) => ({ team: 'team2' as const, index })),
    ];
    const nextEmpty = manual && playerId ? slots.find((slot) => lineup[slot.team][slot.index] === null) : undefined;
    setPicker(nextEmpty ? { matchId: match.id, ...nextEmpty } : null);
  };

  const handleClearAll = () => {
    if (matches.length > 0 && window.confirm('Xóa toàn bộ lịch thi đấu của buổi này?')) {
      updateMatches(() => []);
    }
  };

  const handleFinish = async () => {
    const finished = matches.filter((m) => hasResult(m) && isLineupComplete(m));
    const pending = matches.length - finished.length;

    const message = finished.length === 0
      ? 'Chưa có trận nào có kết quả. Kết thúc và hủy buổi đấu này?'
      : pending > 0
        ? `Lưu ${finished.length} trận đã có kết quả và bỏ ${pending} trận chưa thi đấu?`
        : `Lưu kết quả ${finished.length} trận và kết thúc buổi đấu?`;
    if (!window.confirm(message)) return;

    setFinishing(true);
    let saved = 0;
    try {
      for (const m of finished) {
        const lineup = [...m.team1, ...m.team2].map((id) => playerById.get(id!));
        if (lineup.some((p) => !p)) continue;
        const team1 = lineup.slice(0, perTeam) as Player[];
        const team2 = lineup.slice(perTeam) as Player[];

        await recordNewMatch(buildMatchResult({
          id: `match-${m.id}`,
          date: new Date(`${session.date}T${m.time}`).toISOString(),
          format: session.format,
          importance: session.mode === 'friendly' ? 'casual' : 'league',
          courtName: `${selectedClub.name} - Sân ${m.court}`,
          team1: [team1[0], team1[1]],
          team2: [team2[0], team2[1]],
          score1: m.score1!,
          score2: m.score2!,
        }));
        // Drop it from the session right away so a retry never saves the same match twice
        updateMatches((current) => current.matches.filter((x) => x.id !== m.id));
        saved += 1;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Lỗi không xác định';
      window.alert(`Đã lưu ${saved}/${finished.length} trận. Trận tiếp theo không lưu được: ${reason}`);
      return;
    } finally {
      setFinishing(false);
    }

    onEnd();
    if (finished.length > 0) {
      try {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.5 } });
      } catch {
        // ignore
      }
      setActiveTab('matches');
    }
  };

  // Per-member record across matches that already have a result
  const memberStats = useMemo(() => {
    const stats = new Map(session.memberIds.map((id) => [id, { scheduled: 0, played: 0, wins: 0, diff: 0 }]));
    matches.forEach((m) => {
      const done = hasResult(m);
      (['team1', 'team2'] as const).forEach((key) => {
        const mine = key === 'team1' ? m.score1 : m.score2;
        const theirs = key === 'team1' ? m.score2 : m.score1;
        m[key].forEach((id) => {
          const s = id ? stats.get(id) : undefined;
          if (!s) return;
          s.scheduled += 1;
          if (done) {
            s.played += 1;
            s.diff += mine! - theirs!;
            if (mine! > theirs!) s.wins += 1;
          }
        });
      });
    });
    return stats;
  }, [matches, session.memberIds]);

  const pickerMatch = picker ? matches.find((m) => m.id === picker.matchId) : undefined;
  const pickerTaken = pickerMatch ? [...pickerMatch.team1, ...pickerMatch.team2] : [];
  // Nobody can be on two courts at once; those with the fewest matches are listed first
  const pickerBusy = pickerMatch ? busyAtSameTime(session, pickerMatch) : new Set<string>();
  const pickerCounts = scheduledCounts(session);
  const pickerMembers = [...members].sort((a, b) => (pickerCounts.get(a.id) || 0) - (pickerCounts.get(b.id) || 0));

  return (
    <MobilePage>
      <ScreenHeader
        title="Trận đấu hôm nay"
        onBack={() => setActiveTab('home')}
        right={
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '7px 10px',
            fontSize: '0.78rem',
            fontWeight: 700,
            color: '#0f172a',
            flexShrink: 0,
          }}>
            <CalendarDays size={15} color="#059669" />
            {dateLabel}
          </span>
        }
      />

      <MobileCard style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <SummaryCell
          icon={session.mode === 'friendly' ? <Handshake size={18} /> : <Trophy size={18} />}
          label={session.format === 'doubles' ? '2 vs 2' : '1 vs 1'}
          value={session.mode === 'friendly' ? 'Đấu giao hữu' : 'Đấu giải'}
          sub={`${matches.length} trận`}
        />
        <SummaryCell icon={<Clock size={18} />} label="Thời gian" value={`${session.startTime} - ${session.endTime}`} />
        <SummaryCell icon={<MapPin size={18} />} label={selectedClub.name} value={`Sân ${courtsLabel}`} />
      </MobileCard>

      <div style={{ marginBottom: 14 }}>
        <PillToggle
          stretch
          value={tab}
          onChange={setTab}
          options={[
            { value: 'matches', label: 'Danh sách trận', icon: <ListOrdered size={14} /> },
            { value: 'stats', label: 'Thống kê', icon: <BarChart3 size={14} /> },
            { value: 'members', label: 'Thành viên', icon: <Users size={14} /> },
          ]}
        />
      </div>

      {tab === 'matches' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <h2 style={{ fontSize: '1.02rem', fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap' }}>
                Danh sách trận đấu
              </h2>
              <span style={{
                background: '#dcfce7',
                color: '#15803d',
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
              }}>
                {matches.length} trận
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                onClick={handleClearAll}
                disabled={matches.length === 0}
                title="Xóa toàn bộ"
                aria-label="Xóa toàn bộ"
                style={{ ...iconButtonStyle('#f1f5f9', '#64748b'), opacity: matches.length === 0 ? 0.5 : 1 }}
              >
                <Trash2 size={15} />
              </button>
              <button
                onClick={() => updateMatches((current) => appendMatches(current, 1, { empty: isManualPairing(current) }))}
                style={{
                  border: 'none',
                  borderRadius: 9,
                  padding: '0 12px',
                  height: 30,
                  background: 'linear-gradient(135deg, #10b981, #047857)',
                  color: '#ffffff',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                }}
              >
                <Plus size={15} strokeWidth={3} />
                <span>Thêm trận</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {matches.map((m, index) => {
              const done = hasResult(m);
              const editing = editingId === m.id;
              const renderTeam = (key: TeamKey) => (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                  {m[key].map((id, slot) => (
                    <PlayerSlot
                      key={slot}
                      player={id ? playerById.get(id) : undefined}
                      editable={editing || manual}
                      onPick={() => setPicker({ matchId: m.id, team: key, index: slot })}
                    />
                  ))}
                </div>
              );

              return (
                <MobileCard key={m.id} style={{ padding: '10px 12px', borderColor: editing ? '#10b981' : '#e8eef0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span style={{
                        background: '#f4f6f8',
                        borderRadius: 8,
                        padding: '3px 8px',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: '#475569',
                        whiteSpace: 'nowrap',
                      }}>
                        TRẬN {index + 1} · {m.time}
                      </span>
                      {session.courts > 1 && (
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          Sân {m.court}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{
                        fontSize: '0.64rem',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 999,
                        whiteSpace: 'nowrap',
                        background: done ? '#dcfce7' : '#e0f2fe',
                        color: done ? '#15803d' : '#0369a1',
                      }}>
                        {done ? 'Đã có kết quả' : 'Chưa thi đấu'}
                      </span>
                      {!isLineupComplete(m) && (
                        <button
                          onClick={() => updateMatches((current) => fillMatch(current, m.id))}
                          title="Tự điền ngẫu nhiên các vị trí còn trống"
                          aria-label="Tự điền vị trí trống"
                          style={iconButtonStyle('#ecfdf5', '#047857')}
                        >
                          <Shuffle size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => setEditingId(editing ? null : m.id)}
                        title="Đổi người chơi"
                        aria-label="Đổi người chơi"
                        aria-pressed={editing}
                        style={{
                          ...iconButtonStyle(editing ? '#10b981' : '#f1f5f9', editing ? '#ffffff' : '#475569'),
                          // With manual pairing every position is always tappable, so there is no edit toggle
                          display: manual ? 'none' : 'flex',
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => updateMatches((current) => current.matches.filter((x) => x.id !== m.id))}
                        title="Xóa trận"
                        aria-label="Xóa trận"
                        style={iconButtonStyle('#fee2e2', '#dc2626')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', alignItems: 'center', gap: 6 }}>
                    {renderTeam('team1')}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ScoreStepper
                        value={m.score1}
                        winning={done && m.score1! > m.score2!}
                        onChange={(v) => patchMatch(m.id, { score1: v })}
                      />
                      <span style={{ fontWeight: 900, color: '#94a3b8' }}>:</span>
                      <ScoreStepper
                        value={m.score2}
                        winning={done && m.score2! > m.score1!}
                        onChange={(v) => patchMatch(m.id, { score2: v })}
                      />
                    </div>
                    {renderTeam('team2')}
                  </div>

                  {(editing || (manual && !isLineupComplete(m))) && (
                    <div style={{ fontSize: '0.68rem', color: '#047857', textAlign: 'center', marginTop: 6 }}>
                      {manual ? 'Chạm vào từng vị trí để xếp người chơi.' : 'Chạm vào người chơi để đổi.'}
                    </div>
                  )}
                </MobileCard>
              );
            })}

            {matches.length === 0 && (
              <MobileCard style={{ textAlign: 'center', padding: 24, fontSize: '0.84rem', color: '#64748b' }}>
                {manual
                  ? 'Chưa có trận nào. Bấm “Thêm trận” rồi chọn người cho từng đội.'
                  : 'Chưa có trận nào. Bấm “Thêm trận” để hệ thống tự chia cặp.'}
              </MobileCard>
            )}
          </div>

          <PrimaryButton onClick={handleFinish} disabled={finishing}>
            <Square size={18} fill="#ffffff" />
            <span>{finishing ? 'Đang lưu kết quả...' : 'Kết thúc ngay'}</span>
          </PrimaryButton>

          <div style={{
            display: 'flex',
            gap: 10,
            background: '#ecfdf5',
            border: '1px solid #c9f0d6',
            borderRadius: 16,
            padding: 12,
            marginTop: 14,
          }}>
            <Lightbulb size={20} color="#16a34a" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#064030', marginBottom: 2 }}>Gợi ý</div>
              <ul style={{ fontSize: '0.7rem', color: '#475569', paddingLeft: 14, lineHeight: 1.5 }}>
                {manual ? (
                  <li>Chạm vào từng vị trí để xếp cặp; nút xáo trộn tự điền các vị trí còn trống.</li>
                ) : (
                  <li>Bạn có thể thêm trận để hệ thống tự chia cặp ngẫu nhiên.</li>
                )}
                <li>Nhập tỉ số bất kỳ lúc nào; kết quả được lưu vào CLB khi bạn kết thúc.</li>
                <li>Có thể xóa một trận hoặc xóa toàn bộ lịch thi đấu.</li>
              </ul>
            </div>
          </div>
        </>
      )}

      {tab === 'stats' && (
        <MobileCard style={{ padding: '6px 12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 40px 40px 40px 48px', gap: 6, padding: '8px 0', borderBottom: '1px solid #eef2f4', fontSize: '0.66rem', fontWeight: 700, color: '#94a3b8', textAlign: 'center' }}>
            <span style={{ textAlign: 'left' }}>Thành viên</span>
            <span>Trận</span>
            <span>Thắng</span>
            <span>Thua</span>
            <span>Hiệu số</span>
          </div>
          {[...members]
            .sort((a, b) => memberStats.get(b.id)!.wins - memberStats.get(a.id)!.wins || memberStats.get(b.id)!.diff - memberStats.get(a.id)!.diff)
            .map((p) => {
              const s = memberStats.get(p.id)!;
              return (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 40px 40px 40px 48px', gap: 6, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f4f6f8', fontSize: '0.8rem', fontWeight: 700, textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <Avatar player={p} size={28} />
                    <span style={{ color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                  </div>
                  <span style={{ color: '#475569' }}>{s.played}</span>
                  <span style={{ color: '#16a34a' }}>{s.wins}</span>
                  <span style={{ color: '#dc2626' }}>{s.played - s.wins}</span>
                  <span style={{ color: s.diff > 0 ? '#16a34a' : s.diff < 0 ? '#dc2626' : '#64748b' }}>
                    {s.diff > 0 ? `+${s.diff}` : s.diff}
                  </span>
                </div>
              );
            })}
        </MobileCard>
      )}

      {tab === 'members' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          {members.map((p) => (
            <MobileCard key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10 }}>
              <Avatar player={p} size={38} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  {memberStats.get(p.id)!.scheduled} trận trong lịch
                </div>
              </div>
            </MobileCard>
          ))}
        </div>
      )}

      {/* Player picker sheet */}
      {picker && (
        <div className="modal-overlay" onClick={() => setPicker(null)} style={{ alignItems: 'flex-end', padding: 0 }}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 580,
              maxHeight: '70vh',
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              padding: '18px 16px 28px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>Chọn người chơi</h3>
                {pickerMatch && (
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
                    Trận {matches.indexOf(pickerMatch) + 1} · {pickerMatch.time} · Đội {picker.team === 'team1' ? 1 : 2}
                    {perTeam > 1 ? ` · Vị trí ${picker.index + 1}` : ''}
                  </div>
                )}
              </div>
              <button onClick={() => setPicker(null)} aria-label="Đóng" style={iconButtonStyle('#f1f5f9', '#64748b')}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pickerMembers.map((p) => {
                const inThisMatch = pickerTaken.includes(p.id);
                const onOtherCourt = pickerBusy.has(p.id);
                const taken = inThisMatch || onOtherCourt;
                return (
                  <button
                    key={p.id}
                    disabled={taken}
                    onClick={() => assignSlot(p.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 12,
                      border: '1px solid #eef2f4',
                      background: '#ffffff',
                      cursor: taken ? 'not-allowed' : 'pointer',
                      opacity: taken ? 0.45 : 1,
                      textAlign: 'left',
                    }}
                  >
                    <Avatar player={p} size={32} />
                    <span style={{ flex: 1, fontSize: '0.86rem', fontWeight: 700, color: '#0f172a' }}>{p.name}</span>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {inThisMatch ? 'Đã ở trận này' : onOtherCourt ? 'Đang đấu sân khác' : `${pickerCounts.get(p.id) || 0} trận`}
                    </span>
                  </button>
                );
              })}
              <button
                onClick={() => assignSlot(null)}
                style={{
                  padding: '10px',
                  borderRadius: 12,
                  border: '1px dashed #cbd5e1',
                  background: 'transparent',
                  color: '#64748b',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Bỏ trống vị trí này
              </button>
            </div>
          </div>
        </div>
      )}
    </MobilePage>
  );
};
