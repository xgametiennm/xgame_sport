import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePickleball } from '../context/PickleballContext';
import { GameFormat } from '../types/pickleball';
import { api, ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Activity,
  Calculator,
  CalendarDays,
  Check,
  Clock,
  Handshake,
  Info,
  Lightbulb,
  ListChecks,
  Shuffle,
  Minus,
  Play,
  Plus,
  Repeat,
  Search,
  Trophy,
  Users,
} from 'lucide-react';
import { Avatar, MobileCard, MobilePage, PillToggle, PrimaryButton } from './MobileUi';
import { PlaySessionMobile } from './PlaySessionMobile';
import { appendMatches, PairingMode, PlayMode, PlaySession, playersPerTeam, roundRobinMatches, SLOT_MINUTES } from '../utils/playSession';
import { newRoundRobinCode, roundRobinEvents, roundRobinSummary } from '../utils/roundRobin';
import { RoundRobinResults } from './RoundRobinResults';


const toDateInput = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const SectionTitle: React.FC<{ children: React.ReactNode; right?: React.ReactNode }> = ({ children, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
    <h2 style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>{children}</h2>
    {right}
  </div>
);

const CheckMark: React.FC<{ checked: boolean }> = ({ checked }) => (
  <span style={{
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: checked ? '#059669' : '#ffffff',
    border: checked ? 'none' : '1.5px solid #cbd5e1',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }}>
    {checked && <Check size={12} strokeWidth={3.5} />}
  </span>
);

const optionCardStyle = (selected: boolean): React.CSSProperties => ({
  position: 'relative',
  border: selected ? '1.5px solid #10b981' : '1.5px solid #e2e8f0',
  background: selected ? '#f0fdf4' : '#ffffff',
  borderRadius: 14,
  cursor: 'pointer',
  textAlign: 'left',
});

const FORMAT_OPTIONS: { value: GameFormat; label: string; left: string; right: string }[] = [
  { value: 'doubles', label: '2 vs 2', left: '👥', right: '👥' },
  { value: 'singles', label: '1 vs 1', left: '👤', right: '👤' },
];

const DateTimeField: React.FC<{
  label: string;
  date: string;
  time: string;
  onDate: (v: string) => void;
  onTime: (v: string) => void;
}> = ({ label, date, time, onDate, onTime }) => {
  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' };
  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '0.84rem',
    fontWeight: 600,
    color: '#0f172a',
  };
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 14, background: '#ffffff' }}>
        <label style={{ ...rowStyle, borderBottom: '1px solid #eef2f4' }}>
          <CalendarDays size={16} color="#475569" />
          <input type="date" value={date} onChange={(e) => onDate(e.target.value)} style={inputStyle} />
        </label>
        <label style={rowStyle}>
          <Clock size={16} color="#475569" />
          <input type="time" value={time} onChange={(e) => onTime(e.target.value)} style={inputStyle} />
        </label>
      </div>
    </div>
  );
};

const stepperButtonStyle: React.CSSProperties = {
  width: 40,
  height: 38,
  borderRadius: 10,
  border: 'none',
  background: '#ecfdf5',
  color: '#047857',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

const Stepper: React.FC<{ value: number; min: number; max: number; onChange: (v: number) => void }> = ({
  value,
  min,
  max,
  onChange,
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <button
      type="button"
      aria-label="Giảm"
      onClick={() => onChange(Math.max(min, value - 1))}
      style={stepperButtonStyle}
    >
      <Minus size={18} strokeWidth={3} />
    </button>
    <div style={{
      flex: 1,
      height: 38,
      borderRadius: 10,
      background: '#f4f6f8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 800,
      fontSize: '1rem',
      color: '#0f172a',
    }}>
      {value}
    </div>
    <button
      type="button"
      aria-label="Tăng"
      onClick={() => onChange(Math.min(max, value + 1))}
      style={stepperButtonStyle}
    >
      <Plus size={18} strokeWidth={3} />
    </button>
  </div>
);

const PlaySetup: React.FC<{ onCreate: (session: PlaySession) => void; onOpenResults: (code: string) => void }> = ({ onCreate, onOpenResults }) => {
  const { players, matches, selectedClub, setActiveTab } = usePickleball();
  const [today] = useState(() => toDateInput(new Date()));

  const [format, setFormat] = useState<GameFormat>('doubles');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [startTime, setStartTime] = useState('19:00');
  const [endDate, setEndDate] = useState(today);
  const [endTime, setEndTime] = useState('21:00');
  const [mode, setMode] = useState<PlayMode>('friendly');
  const [pairing, setPairing] = useState<PairingMode>('auto');
  const [courts, setCourts] = useState(1);
  const [countMode, setCountMode] = useState<'auto' | 'custom'>('auto');
  const [customCount, setCustomCount] = useState(6);
  const [eventName, setEventName] = useState('');

  const roundRobin = pairing === 'roundRobin';
  // Automatic doubles always schedules the full rotation: every member partners every other once
  const fullRotation = roundRobin || (pairing === 'auto' && format === 'doubles');
  const pastEvents = useMemo(() => roundRobinEvents(matches).slice(0, 5), [matches]);

  const maxCourts = Math.max(1, selectedClub.courtsCount);
  const needed = playersPerTeam(format) * 2;
  const rrSummary = roundRobinSummary(selectedIds.length);
  // Matches of a round run side by side, ~n/4 at a time, capped by the courts
  const rrSlots = Math.ceil(rrSummary.matches / Math.max(1, Math.min(courts, Math.floor(selectedIds.length / 4))));

  const visiblePlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? players.filter((p) => p.name.toLowerCase().includes(query)) : players;
  }, [players, search]);

  const durationMinutes = Math.round(
    (new Date(`${endDate}T${endTime}`).getTime() - new Date(`${startDate}T${startTime}`).getTime()) / 60000
  );
  const validDuration = Number.isFinite(durationMinutes) && durationMinutes > 0;
  const autoCount = validDuration ? Math.max(1, Math.floor(durationMinutes / SLOT_MINUTES) * courts) : 0;
  const matchCount = countMode === 'auto' ? autoCount : customCount;

  // Partner rotation only exists for doubles
  const choosePairing = (value: PairingMode) => {
    setPairing(value);
    if (value === 'roundRobin') setFormat('doubles');
  };
  const chooseFormat = (value: GameFormat) => {
    setFormat(value);
    if (value === 'singles' && pairing === 'roundRobin') setPairing('auto');
  };

  const toggleMember = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const allVisibleSelected = visiblePlayers.length > 0 && visiblePlayers.every((p) => selectedIds.includes(p.id));
  const quickSelect = () => {
    const visibleIds = visiblePlayers.map((p) => p.id);
    setSelectedIds((prev) =>
      allVisibleSelected
        ? prev.filter((id) => !visibleIds.includes(id))
        : [...new Set([...prev, ...visibleIds])]
    );
  };

  const problem = !validDuration
    ? 'Thời gian kết thúc phải sau thời gian bắt đầu.'
    : selectedIds.length < needed
      ? `Chọn ít nhất ${needed} thành viên để tạo trận ${format === 'doubles' ? '2 vs 2' : '1 vs 1'}.`
      : null;

  const handleCreate = () => {
    if (problem) return;
    const session: PlaySession = {
      format,
      mode,
      pairing,
      memberIds: selectedIds,
      date: startDate,
      startTime,
      endTime,
      courts,
      matches: [],
    };
    if (roundRobin) {
      const [, m, d] = startDate.split('-');
      const name = eventName.trim() || `Xoay cặp ${d}/${m} ${startTime}`;
      const schedule = roundRobinMatches(session);
      onCreate({ ...session, eventName: name, eventCode: newRoundRobinCode(), rounds: schedule.rounds, matches: schedule.matches });
      return;
    }
    if (fullRotation) {
      const schedule = roundRobinMatches(session);
      onCreate({ ...session, rounds: schedule.rounds, matches: schedule.matches });
      return;
    }
    // Manual pairing starts from empty matches that the organiser fills in
    onCreate({ ...session, matches: appendMatches(session, matchCount, { empty: pairing === 'manual' }) });
  };

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  const durationLabel = [hours > 0 ? `${hours} giờ` : '', minutes > 0 ? `${minutes} phút` : ''].filter(Boolean).join(' ');

  return (
    <MobilePage>
      <MobileCard style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* 1. FORMAT */}
        <section>
          <SectionTitle>1. Chọn thể thức chơi</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {FORMAT_OPTIONS.map((opt) => {
              const selected = format === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => chooseFormat(opt.value)}
                  style={{ ...optionCardStyle(selected), padding: '12px 8px', textAlign: 'center' }}
                >
                  <span style={{ position: 'absolute', top: 8, right: 8 }}>
                    <CheckMark checked={selected} />
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '1.5rem' }}>
                    <span>{opt.left}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b' }}>VS</span>
                    <span>{opt.right}</span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: selected ? '#047857' : '#334155', marginTop: 4 }}>
                    {opt.label}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. MEMBERS */}
        <section>
          <SectionTitle
            right={
              <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b' }}>
                Đã chọn {selectedIds.length}/{players.length}
              </span>
            }
          >
            2. Chọn thành viên tham gia
          </SectionTitle>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <label style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#f4f6f8',
              borderRadius: 12,
              padding: '8px 12px',
            }}>
              <Search size={16} color="#94a3b8" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm thành viên..."
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.84rem' }}
              />
            </label>
            <button
              type="button"
              onClick={quickSelect}
              style={{
                border: 'none',
                borderRadius: 12,
                padding: '8px 12px',
                background: '#ecfdf5',
                color: '#047857',
                fontWeight: 700,
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <Users size={16} />
              <span>{allVisibleSelected ? 'Bỏ chọn' : 'Chọn nhanh'}</span>
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 8,
            maxHeight: 196,
            overflowY: 'auto',
            paddingRight: 2,
          }}>
            {visiblePlayers.map((p) => {
              const selected = selectedIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleMember(p.id)}
                  aria-pressed={selected}
                  style={{ ...optionCardStyle(selected), padding: '10px 4px 8px', textAlign: 'center', minWidth: 0 }}
                >
                  <span style={{ position: 'absolute', top: 5, right: 5 }}>
                    <CheckMark checked={selected} />
                  </span>
                  <Avatar player={p} size={40} ring="#ffffff" />
                  <div style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    marginTop: 4,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {p.name}
                  </div>
                </button>
              );
            })}
            {visiblePlayers.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: 16, textAlign: 'center', fontSize: '0.82rem', color: '#94a3b8' }}>
                Không tìm thấy thành viên nào.
              </div>
            )}
          </div>
        </section>

        {/* 3. DATE & TIME */}
        <section>
          <SectionTitle>3. Chọn ngày giờ</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <DateTimeField
              label="Thời gian bắt đầu"
              date={startDate}
              time={startTime}
              onDate={(v) => {
                setStartDate(v);
                if (v > endDate) setEndDate(v);
              }}
              onTime={setStartTime}
            />
            <DateTimeField
              label="Thời gian kết thúc"
              date={endDate}
              time={endTime}
              onDate={setEndDate}
              onTime={setEndTime}
            />
          </div>
        </section>

        {/* 4. MODE */}
        <section>
          <SectionTitle>4. Chọn chế độ chơi</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {([
              { value: 'friendly', title: 'Đấu giao hữu', desc: 'Thi đấu giao lưu, không tính giải', icon: <Handshake size={24} color="#059669" /> },
              { value: 'tournament', title: 'Đấu giải', desc: 'Tính thành tích, xếp hạng giải', icon: <Trophy size={24} color="#f59e0b" /> },
            ] as const).map((opt) => {
              const selected = mode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMode(opt.value)}
                  style={{ ...optionCardStyle(selected), padding: '10px 28px 10px 10px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}
                >
                  <span style={{ position: 'absolute', top: 8, right: 8 }}>
                    <CheckMark checked={selected} />
                  </span>
                  <span style={{ flexShrink: 0, display: 'flex' }}>{opt.icon}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 800, fontSize: '0.84rem', color: '#0f172a' }}>{opt.title}</span>
                    <span style={{ display: 'block', fontSize: '0.66rem', color: '#64748b', lineHeight: 1.3 }}>{opt.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 5. PAIRING */}
        <section>
          <SectionTitle>5. Cách chia cặp</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {([
              { value: 'auto', title: 'Tự động', desc: 'Hệ thống xếp đủ trận để ai cũng cặp với mọi người', icon: <Shuffle size={24} color="#059669" /> },
              { value: 'manual', title: 'Tự xếp cặp', desc: 'Bạn tự tạo trận và chọn người cho từng đội', icon: <ListChecks size={24} color="#2563eb" /> },
              { value: 'roundRobin', title: 'Xoay cặp (Round robin)', desc: 'Ai cũng cặp với mọi người đúng 1 lần, có bảng xếp hạng riêng', icon: <Repeat size={24} color="#9333ea" /> },
            ] as const).map((opt) => {
              const selected = pairing === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => choosePairing(opt.value)}
                  aria-pressed={selected}
                  style={{
                    ...optionCardStyle(selected),
                    padding: '10px 28px 10px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minWidth: 0,
                    gridColumn: opt.value === 'roundRobin' ? '1 / -1' : undefined,
                  }}
                >
                  <span style={{ position: 'absolute', top: 8, right: 8 }}>
                    <CheckMark checked={selected} />
                  </span>
                  <span style={{ flexShrink: 0, display: 'flex' }}>{opt.icon}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 800, fontSize: '0.84rem', color: '#0f172a' }}>{opt.title}</span>
                    <span style={{ display: 'block', fontSize: '0.66rem', color: '#64748b', lineHeight: 1.3 }}>{opt.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 6 & 7. COURTS + MATCH COUNT */}
        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)', gap: 14 }}>
          <div>
            <SectionTitle>6. Số sân đấu</SectionTitle>
            <Stepper value={courts} min={1} max={maxCourts} onChange={setCourts} />
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 6 }}>
              Sân khả dụng: 1 - {maxCourts}
            </div>
          </div>

          {fullRotation ? (
            <div>
              <SectionTitle>{roundRobin ? '7. Lịch xoay cặp' : '7. Số trận đấu'}</SectionTitle>
              <div style={{ fontSize: '0.7rem', color: '#475569', lineHeight: 1.5 }}>
                {selectedIds.length >= 4 ? (
                  <>
                    <strong style={{ color: '#7e22ce' }}>{selectedIds.length} người → {rrSummary.matches} trận</strong>
                    <div>Mỗi người đánh ~{rrSummary.perMember} trận, cặp với từng người còn lại 1 lần.</div>
                    <div>Cần khoảng {rrSlots * SLOT_MINUTES} phút ({rrSlots} lượt × {SLOT_MINUTES} phút).</div>
                    {!rrSummary.perfect && (
                      <div style={{ color: '#b45309' }}>
                        Với {selectedIds.length} người không chia đều tuyệt đối: sẽ có 1 trận có cặp lặp lại. Chọn 4, 5, 8, 9, 12… người để chia đều.
                      </div>
                    )}
                  </>
                ) : 'Chọn ít nhất 4 người.'}
              </div>
            </div>
          ) : (
          <div>
            <SectionTitle>7. Số trận đấu</SectionTitle>
            <PillToggle
              stretch
              value={countMode}
              onChange={setCountMode}
              options={[
                { value: 'auto', label: 'Tự động' },
                { value: 'custom', label: 'Tùy chỉnh' },
              ]}
            />
            {countMode === 'auto' ? (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <Lightbulb size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: '0.68rem', color: '#64748b', lineHeight: 1.4 }}>
                  <strong style={{ color: '#047857' }}>Dự kiến: {autoCount} trận</strong>
                  {validDuration && (
                    <div>
                      Thời gian chơi: {durationLabel} • {courts} sân • ~{SLOT_MINUTES} phút/trận (gồm nghỉ 2–3 phút)
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                <Stepper value={customCount} min={1} max={60} onChange={setCustomCount} />
              </div>
            )}
          </div>
          )}
        </section>

        {roundRobin && (
          <section>
            <SectionTitle>8. Tên giải (tuỳ chọn)</SectionTitle>
            <input
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="VD: Xoay cặp tối thứ 5"
              className="input-light"
              style={{ width: '100%', padding: '9px 12px', fontSize: '0.84rem', boxSizing: 'border-box' }}
            />
          </section>
        )}

        <div>
          {problem && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: '#b45309', marginBottom: 8 }}>
              <Info size={14} style={{ flexShrink: 0 }} />
              <span>{problem}</span>
            </div>
          )}
          <PrimaryButton onClick={handleCreate} disabled={!!problem}>
            <Play size={20} fill="#ffffff" />
            <span>{roundRobin ? 'Tạo lịch xoay cặp' : 'Tạo trận đấu'}</span>
          </PrimaryButton>
        </div>
      </MobileCard>

      {pastEvents.length > 0 && (
        <MobileCard style={{ marginTop: 12, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Repeat size={16} color="#9333ea" />
            <h2 style={{ fontSize: '0.9rem', fontWeight: 900, color: '#0f172a' }}>Giải xoay cặp đã đấu</h2>
          </div>
          {pastEvents.map((e) => (
            <button
              key={e.code}
              type="button"
              onClick={() => onOpenResults(e.code)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '8px 0',
                border: 'none',
                borderTop: '1px solid #f4f6f8',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</span>
                <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b' }}>
                  {new Date(e.date).toLocaleDateString('vi-VN')} · {e.matches.length} trận
                </span>
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7e22ce', whiteSpace: 'nowrap' }}>Xem kết quả ›</span>
            </button>
          ))}
        </MobileCard>
      )}

      {/* Other on-court tools */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        {([
          { tab: 'scoreboard', label: 'Bảng điểm trực tiếp', icon: <Activity size={16} /> },
          { tab: 'calculator', label: 'Máy tính DUPR', icon: <Calculator size={16} /> },
        ] as const).map((tool) => (
          <button
            key={tool.tab}
            onClick={() => setActiveTab(tool.tab)}
            style={{
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              borderRadius: 14,
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            {tool.icon}
            <span>{tool.label}</span>
          </button>
        ))}
      </div>
    </MobilePage>
  );
};


const SAVE_DELAY_MS = 500;
const SCORE_DELAY_MS = 400;
const POLL_MS = 4000;

const errorText = (err: unknown): string =>
  err instanceof Error ? err.message : 'Không kết nối được máy chủ';

interface PendingScore {
  score1: number | null;
  score2: number | null;
  timer?: number; // set while waiting to be sent
}

// The in-progress session belongs to the club and is stored on the server, so everyone in
// the club follows the same session live from their own device:
// - scores are sent one match at a time (any member may enter them),
// - schedule changes are sent whole by the organiser, based on the latest version seen,
// - the screen re-reads the session every few seconds while it is visible.
export const PlayMobile: React.FC = () => {
  const { selectedClub, isManager, refreshClub } = usePickleball();
  const { currentUser } = useAuth();
  const clubId = selectedClub.id;

  const [loaded, setLoaded] = useState<{ clubId: string; session: PlaySession | null } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Round robin whose final ranking is on screen (right after it ends, or opened from the list)
  const [resultsCode, setResultsCode] = useState<string | null>(null);

  const sessionRef = useRef<PlaySession | null>(null);
  // Schedule version and write revision of the newest server copy seen
  const serverVersion = useRef(0);
  const serverRevision = useRef(0);
  // Schedule change waiting to be sent, and the save on its way
  const pendingSave = useRef<{ timer: number; run: () => void } | null>(null);
  const saving = useRef<Promise<void> | null>(null);
  // Scores entered here that the server has not confirmed yet, by match id
  const pendingScores = useRef(new Map<string, PendingScore>());

  const show = (session: PlaySession | null) => {
    sessionRef.current = session;
    setLoaded({ clubId, session });
  };

  const remember = (session: PlaySession) => {
    serverVersion.current = session.version || 0;
    serverRevision.current = session.revision || 0;
  };

  // Scores still being sent from this device stay on screen over the server's copy
  const withLocalScores = (session: PlaySession): PlaySession => {
    if (pendingScores.current.size === 0) return session;
    return {
      ...session,
      matches: session.matches.map((m) => {
        const local = pendingScores.current.get(m.id);
        return local ? { ...m, score1: local.score1, score2: local.score2 } : m;
      }),
    };
  };

  // Shows a copy of the session read from the server (a poll or a reply)
  const applyServer = (server: PlaySession | null) => {
    // Schedule edits made here win until they are saved
    if (pendingSave.current || saving.current) return;
    if (!server) {
      const previous = sessionRef.current;
      if (!previous) return;
      // Someone ended the session: show what was saved, as on the device that ended it
      show(null);
      refreshClub()
        .then(() => {
          if (previous.pairing === 'roundRobin' && previous.eventCode) setResultsCode(previous.eventCode);
        })
        .catch(() => {});
      return;
    }
    if ((server.revision || 0) < serverRevision.current) return; // an older reply arriving late
    remember(server);
    show(withLocalScores(server));
  };

  // Latest applyServer for the polling effect, which is set up once per session
  const applyServerRef = useRef(applyServer);
  useEffect(() => {
    applyServerRef.current = applyServer;
  });

  const sendScore = (matchId: string) => {
    const entry = pendingScores.current.get(matchId);
    if (!entry) return;
    entry.timer = undefined;
    const sent = { score1: entry.score1, score2: entry.score2 };
    api.updateSessionScore(clubId, matchId, sent.score1, sent.score2)
      .then((server) => {
        const now = pendingScores.current.get(matchId);
        // Keep it pending if it was changed again while this one was on its way
        if (now && !now.timer && now.score1 === sent.score1 && now.score2 === sent.score2) {
          pendingScores.current.delete(matchId);
        }
        setSaveFailed(false);
        applyServerRef.current(server);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          // The match was removed, or the session ended, on another device
          pendingScores.current.delete(matchId);
          applyServerRef.current((err.data as PlaySession | undefined) ?? null);
          window.alert(err.message);
        } else {
          setSaveFailed(true);
        }
      });
  };

  const flushScores = () => {
    pendingScores.current.forEach((entry, matchId) => {
      if (entry.timer) window.clearTimeout(entry.timer);
      sendScore(matchId);
    });
  };

  const saveSchedule = async () => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      const saved = await api.saveSession(clubId, { ...session, version: serverVersion.current });
      remember(saved);
      setSaveFailed(false);
      if (sessionRef.current) {
        sessionRef.current = { ...sessionRef.current, version: saved.version, revision: saved.revision, createdByUserId: saved.createdByUserId };
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.status === 403)) {
        // Someone else changed the schedule, or this account may not: start again from the server's copy
        if (pendingSave.current) window.clearTimeout(pendingSave.current.timer);
        pendingSave.current = null;
        const server = (err.data as PlaySession | undefined) ?? (await api.getSession(clubId).catch(() => null));
        if (server) {
          remember(server);
          show(withLocalScores(server));
        }
        window.alert(err.message);
      } else {
        setSaveFailed(true);
      }
    }
  };

  // One schedule save at a time, always sending the latest schedule
  const runScheduleSave = async () => {
    await saving.current;
    const run = saveSchedule();
    saving.current = run;
    await run;
    if (saving.current === run) saving.current = null;
  };

  useEffect(() => {
    let cancelled = false;
    api.getSession(clubId)
      .then((session) => {
        if (cancelled) return;
        sessionRef.current = session;
        serverVersion.current = session?.version || 0;
        serverRevision.current = session?.revision || 0;
        setLoadError(null);
        setLoaded({ clubId, session });
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorText(err));
      });
    const scores = pendingScores.current;
    return () => {
      cancelled = true;
      // Leaving the screen (or switching club) must not drop an edit that is still waiting to be sent
      if (pendingSave.current) {
        window.clearTimeout(pendingSave.current.timer);
        pendingSave.current.run();
        pendingSave.current = null;
      }
      // Same for scores typed in the last moment
      scores.forEach((entry, matchId) => {
        if (!entry.timer) return;
        window.clearTimeout(entry.timer);
        api.updateSessionScore(clubId, matchId, entry.score1, entry.score2).catch(() => {});
      });
      scores.clear();
    };
  }, [clubId, reloadKey]);

  const current = loaded && loaded.clubId === clubId ? loaded : null;
  const hasSession = !!current?.session;

  // Follow changes made on other devices while a session is open and the page is visible
  useEffect(() => {
    if (!hasSession) return;
    let stopped = false;
    const poll = () => {
      if (document.visibilityState !== 'visible') return;
      api.getSession(clubId)
        .then((server) => {
          if (!stopped) applyServerRef.current(server);
        })
        .catch(() => {
          // offline for a moment: the next poll tries again
        });
    };
    const timer = window.setInterval(poll, POLL_MS);
    document.addEventListener('visibilitychange', poll);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [clubId, hasSession]);

  if (loadError && !current) {
    return (
      <MobilePage>
        <MobileCard style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: '0.86rem', color: '#475569', marginBottom: 12 }}>{loadError}</div>
          <button className="btn-court" onClick={() => { setLoadError(null); setReloadKey((k) => k + 1); }}>
            Thử lại
          </button>
        </MobileCard>
      </MobilePage>
    );
  }

  if (!current) {
    return (
      <MobilePage>
        <MobileCard style={{ textAlign: 'center', padding: 24, fontSize: '0.86rem', color: '#64748b' }}>
          Đang tải buổi đấu...
        </MobileCard>
      </MobilePage>
    );
  }

  const handleCreate = async (session: PlaySession) => {
    try {
      // Based on "no session": the server refuses it if someone started one meanwhile
      const saved = await api.saveSession(clubId, { ...session, version: serverVersion.current });
      remember(saved);
      pendingScores.current.clear();
      show(saved);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.data) {
        const server = err.data as PlaySession;
        remember(server);
        show(server);
        window.alert('Đã có người khác tạo buổi đấu cho CLB. Đang mở buổi đấu đó.');
        return;
      }
      window.alert(errorText(err));
    }
  };

  // Schedule changes (lineups, added or removed matches), saved shortly after the last one
  const handleChange = (update: (session: PlaySession) => PlaySession) => {
    if (!sessionRef.current) return;
    show(update(sessionRef.current));

    if (pendingSave.current) window.clearTimeout(pendingSave.current.timer);
    const run = () => {
      runScheduleSave();
    };
    pendingSave.current = {
      run,
      timer: window.setTimeout(() => {
        pendingSave.current = null;
        run();
      }, SAVE_DELAY_MS),
    };
  };

  const handleScore = (matchId: string, score1: number | null, score2: number | null) => {
    const previous = pendingScores.current.get(matchId);
    if (previous?.timer) window.clearTimeout(previous.timer);
    pendingScores.current.set(matchId, {
      score1,
      score2,
      timer: window.setTimeout(() => sendScore(matchId), SCORE_DELAY_MS),
    });
    const session = sessionRef.current;
    if (session) {
      show({ ...session, matches: session.matches.map((m) => (m.id === matchId ? { ...m, score1, score2 } : m)) });
    }
  };

  const handleEnd = async (roundRobinCode?: string) => {
    if (pendingSave.current) {
      window.clearTimeout(pendingSave.current.timer);
      pendingSave.current = null;
    }
    try {
      await saving.current;
      await api.deleteSession(clubId);
      pendingScores.current.forEach((entry) => entry.timer && window.clearTimeout(entry.timer));
      pendingScores.current.clear();
      show(null);
      if (roundRobinCode) setResultsCode(roundRobinCode);
    } catch (err) {
      window.alert(errorText(err));
    }
  };

  // Club managers and whoever started the session run it; everyone else enters scores
  const canManage = isManager || (!!currentUser && current.session?.createdByUserId === currentUser.id);

  const handleRetry = () => {
    setSaveFailed(false);
    flushScores();
    if (canManage) runScheduleSave();
  };

  if (!current.session) {
    return resultsCode
      ? <RoundRobinResults code={resultsCode} onBack={() => setResultsCode(null)} />
      : <PlaySetup onCreate={handleCreate} onOpenResults={setResultsCode} />;
  }

  return (
    <>
      {saveFailed && (
        <div role="alert" style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: '#fef2f2',
          borderBottom: '1px solid #fecaca',
          color: '#b91c1c',
          fontSize: '0.78rem',
          fontWeight: 700,
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}>
          <span>Chưa lưu được thay đổi lên máy chủ.</span>
          <button
            onClick={handleRetry}
            style={{ border: 'none', background: 'transparent', color: '#b91c1c', fontWeight: 800, textDecoration: 'underline', cursor: 'pointer' }}
          >
            Thử lại
          </button>
        </div>
      )}
      <PlaySessionMobile
        session={current.session}
        canManage={canManage}
        onChange={handleChange}
        onScore={handleScore}
        onEnd={handleEnd}
      />
    </>
  );
};
