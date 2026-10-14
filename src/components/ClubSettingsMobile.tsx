import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { usePickleball } from '../context/PickleballContext';
import { ClubRole, Player } from '../types/pickleball';
import {
  Check,
  Copy,
  Crown,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  Trash2,
  User,
  Users,
  Star,
} from 'lucide-react';
import { Avatar, MobileCard, MobilePage, ScreenHeader } from './MobileUi';
import { doublesWinRate, playerDisplayId } from '../utils/playerStats';

const ROLE_LABEL: Record<ClubRole, string> = {
  owner: 'Chủ CLB',
  admin: 'Quản trị viên',
  member: 'Thành viên',
};

const ROLE_STYLE: Record<ClubRole, React.CSSProperties> = {
  owner: { background: '#fef3c7', color: '#92400e', borderColor: '#fde68a' },
  admin: { background: '#dbeafe', color: '#1d4ed8', borderColor: '#bfdbfe' },
  member: { background: '#f4f6f8', color: '#334155', borderColor: '#e2e8f0' },
};

const errorText = (err: unknown): string =>
  err instanceof Error ? err.message : 'Thao tác không thành công';

const EditableField: React.FC<{
  label: string;
  value: string;
  large?: boolean;
  readOnly?: boolean;
  onCommit: (value: string) => Promise<void>;
}> = ({ label, value, large, readOnly, onCommit }) => {
  const [draft, setDraft] = useState(value);

  const commit = () => {
    const next = draft.trim();
    if (!next || next === value) {
      setDraft(value);
      return;
    }
    onCommit(next).catch((err) => {
      window.alert(errorText(err));
      setDraft(value);
    });
  };

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', marginBottom: 3 }}>{label}</div>
      <label style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        border: '1.5px solid #e2e8f0',
        borderRadius: 12,
        padding: '8px 10px',
        background: '#ffffff',
      }}>
        <input
          value={draft}
          readOnly={readOnly}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: large ? '1.02rem' : '0.82rem',
            fontWeight: large ? 800 : 500,
            fontFamily: large ? 'var(--font-display)' : 'inherit',
            color: '#0f172a',
          }}
        />
        {!readOnly && <Pencil size={14} color="#64748b" style={{ flexShrink: 0 }} />}
      </label>
    </div>
  );
};

export const ClubSettingsMobile: React.FC = () => {
  const {
    players,
    selectedClub,
    defaultClubId,
    setDefaultClub,
    setActiveTab,
    updateClub,
    addNewPlayer,
    removePlayer,
    updatePlayerRole,
    deleteClub,
    myPlayer,
    isManager,
  } = usePickleball();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | ClubRole>('all');
  const [menuPlayerId, setMenuPlayerId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [newMemberName, setNewMemberName] = useState<string | null>(null);
  const [newMemberEmail, setNewMemberEmail] = useState('');

  const isOwner = selectedClub.myRole === 'owner';
  const { joinCode } = selectedClub;
  // Opening this link signs the person in and redeems the code
  const inviteLink = `${window.location.origin}${window.location.pathname}?join=${joinCode}`;
  const roleOf = (p: Player): ClubRole => p.role || 'member';
  const ownerCount = players.filter((p) => roleOf(p) === 'owner').length;

  const rankedPlayers = useMemo(
    () => [...players].sort((a, b) => b.winsDoubles - a.winsDoubles),
    [players]
  );

  const visiblePlayers = rankedPlayers.filter((p) => {
    if (roleFilter !== 'all' && roleOf(p) !== roleFilter) return false;
    const query = search.trim().toLowerCase();
    return !query || p.name.toLowerCase().includes(query) || playerDisplayId(p).toLowerCase().includes(query);
  });

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  const shareCode = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: selectedClub.name, text: `Mã tham gia ${selectedClub.name}: ${joinCode}`, url: inviteLink });
      } catch {
        // share sheet dismissed
      }
    } else {
      copyCode();
    }
  };

  // Runs a server change and reports why it was rejected (e.g. missing permission)
  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    try {
      await action();
      return true;
    } catch (err) {
      window.alert(errorText(err));
      return false;
    }
  };

  // A club can have several owners; giving up your own ownership is confirmed first
  const changeRole = (player: Player, role: ClubRole) => {
    const steppingDown = player.id === myPlayer?.id && roleOf(player) === 'owner' && role !== 'owner';
    if (steppingDown && !window.confirm('Bạn sẽ không còn là chủ CLB này nữa. Tiếp tục?')) return;
    run(() => updatePlayerRole(player.id, role));
  };

  const handleRemove = (player: Player) => {
    setMenuPlayerId(null);
    if (window.confirm(`Xóa ${player.name} khỏi CLB?`)) {
      run(() => removePlayer(player.id));
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = (newMemberName || '').trim();
    if (!name) return;
    if (await run(() => addNewPlayer(name, 3.5, 3.2, newMemberEmail))) {
      setNewMemberName(null);
      setNewMemberEmail('');
    }
  };

  const handleDeleteClub = () => {
    if (window.confirm(`Xóa vĩnh viễn "${selectedClub.name}" cùng toàn bộ thành viên, trận đấu và thống kê? Không thể hoàn tác.`)) {
      run(deleteClub);
    }
  };

  const menuItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '9px 12px',
    border: 'none',
    background: 'transparent',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#0f172a',
    cursor: 'pointer',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  };

  return (
    <MobilePage>
      <ScreenHeader title="Cài đặt CLB" onBack={() => setActiveTab('home')} />

      {/* 0. DEFAULT CLUB SETTING CARD */}
      <MobileCard style={{ marginBottom: 14, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              background: defaultClubId === selectedClub.id ? '#fef3c7' : '#f1f5f9',
              color: defaultClubId === selectedClub.id ? '#d97706' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Star size={22} fill={defaultClubId === selectedClub.id ? '#d97706' : 'none'} color={defaultClubId === selectedClub.id ? '#d97706' : '#64748b'} />
            </div>
            <div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                Câu Lạc Bộ Mặc Định
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                Tự động mở CLB này đầu tiên mỗi khi bạn đăng nhập hoặc mở ứng dụng
              </div>
            </div>
          </div>

          <div>
            {defaultClubId === selectedClub.id ? (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#ecfdf5',
                color: '#059669',
                border: '1.5px solid #a7f3d0',
                padding: '6px 14px',
                borderRadius: 999,
                fontSize: '0.8rem',
                fontWeight: 800,
              }}>
                <Check size={15} strokeWidth={2.5} />
                <span>Đây là CLB mặc định của bạn</span>
              </div>
            ) : (
              <button
                onClick={() => setDefaultClub(selectedClub.id)}
                className="btn-primary"
                style={{
                  padding: '7px 16px',
                  borderRadius: 999,
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Star size={14} fill="#ffffff" />
                <span>Đặt làm CLB mặc định</span>
              </button>
            )}
          </div>
        </div>
      </MobileCard>

      {/* 1. CLUB INFO + JOIN CODE */}
      <MobileCard style={{ marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '84px minmax(0, 1fr)', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 84,
            height: 84,
            borderRadius: 20,
            background: 'linear-gradient(135deg, #10b981, #047857)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.6rem',
            boxShadow: '0 6px 16px rgba(16, 185, 129, 0.3)',
          }}>
            🏓
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <EditableField
              key={`name-${selectedClub.id}`}
              label="Tên CLB"
              value={selectedClub.name}
              large
              readOnly={!isManager}
              onCommit={(name) => updateClub({ name })}
            />
            <EditableField
              key={`desc-${selectedClub.id}`}
              label="Mô tả (tuỳ chọn)"
              value={selectedClub.description}
              readOnly={!isManager}
              onCommit={(description) => updateClub({ description })}
            />
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '96px minmax(0, 1fr)',
          gap: 12,
          alignItems: 'center',
          borderTop: '1px solid #eef2f4',
          paddingTop: 12,
        }}>
          <QRCodeSVG value={inviteLink} size={96} level="M" />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0f172a' }}>Mã tham gia CLB</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', lineHeight: 1.4, marginBottom: 8 }}>
              Quét mã QR để tham gia CLB hoặc chia sẻ mã bên dưới.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={copyCode}
                title="Sao chép mã"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  border: 'none',
                  background: '#f4f6f8',
                  borderRadius: 12,
                  padding: '9px 12px',
                  cursor: 'pointer',
                }}
              >
                <span className="mono" style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>{joinCode}</span>
                {copied ? <Check size={15} color="#059669" /> : <Copy size={15} color="#64748b" />}
              </button>
              <button
                onClick={shareCode}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  border: '1.5px solid #10b981',
                  background: '#ffffff',
                  color: '#047857',
                  borderRadius: 12,
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <Share2 size={15} />
                <span>Chia sẻ mã</span>
              </button>
            </div>
          </div>
        </div>
      </MobileCard>

      {/* 2. MEMBERS */}
      <MobileCard style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={18} color="#2563eb" />
            <h2 style={{ fontSize: '0.86rem', fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap' }}>
              Danh sách thành viên
            </h2>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>({players.length})</span>
          </div>
          {isManager && <button
            onClick={() => setNewMemberName('')}
            style={{
              border: 'none',
              borderRadius: 10,
              padding: '6px 8px',
              background: 'linear-gradient(135deg, #10b981, #047857)',
              color: '#ffffff',
              fontSize: '0.68rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <Plus size={14} strokeWidth={3} />
            <span>Thêm thành viên</span>
          </button>}
        </div>

        {newMemberName !== null && (
          <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            <input
              autoFocus
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="Tên thành viên mới"
              className="input-light"
              style={{ padding: '8px 12px', fontSize: '0.84rem' }}
              required
            />
            <input
              type="email"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              placeholder="Email (tuỳ chọn)"
              className="input-light"
              style={{ padding: '8px 12px', fontSize: '0.84rem' }}
            />
            <div style={{ fontSize: '0.68rem', color: '#64748b', lineHeight: 1.4 }}>
              Thành viên thêm tay là khách, chưa có tài khoản. Nếu nhập email, người có tài khoản
              với email đó sẽ nhận lại hồ sơ này khi tham gia CLB bằng mã.
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="submit" className="btn-court" style={{ flex: 1, padding: '8px 14px', fontSize: '0.8rem' }}>Thêm</button>
              <button type="button" onClick={() => setNewMemberName(null)} className="btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
                Hủy
              </button>
            </div>
          </form>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
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
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'all' | ClubRole)}
            aria-label="Lọc theo quyền"
            style={{
              border: 'none',
              background: '#f4f6f8',
              borderRadius: 12,
              padding: '8px 10px',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <option value="all">Tất cả quyền</option>
            <option value="owner">{ROLE_LABEL.owner}</option>
            <option value="admin">{ROLE_LABEL.admin}</option>
            <option value="member">{ROLE_LABEL.member}</option>
          </select>
        </div>

        {visiblePlayers.map((p) => {
          const role = roleOf(p);
          const rank = rankedPlayers.indexOf(p) + 1;
          // Managers change roles; only owners touch other owners, and the last owner stays
          const canManage = isManager && (role !== 'owner' || (isOwner && ownerCount > 1));
          return (
            <div
              key={p.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '20px auto minmax(0, 1fr) auto 24px',
                alignItems: 'center',
                gap: 8,
                padding: '9px 0',
                borderBottom: '1px solid #f4f6f8',
              }}
            >
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textAlign: 'center' }}>
                {role === 'owner' ? <Crown size={16} color="#f59e0b" fill="#fbbf24" /> : rank}
              </span>
              <Avatar player={p} size={36} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.name}{p.id === myPlayer?.id ? ' (bạn)' : ''}
                </div>
                <div style={{ fontSize: '0.66rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.userId ? `ID: ${playerDisplayId(p)}` : 'Khách (chưa có tài khoản)'}
                </div>
                <div style={{ fontSize: '0.66rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.matchesPlayedDoubles} trận · {doublesWinRate(p)}% thắng
                </div>
              </div>

              {canManage ? (
                <select
                  value={role}
                  onChange={(e) => changeRole(p, e.target.value as ClubRole)}
                  aria-label={`Quyền của ${p.name}`}
                  style={{
                    ...ROLE_STYLE[role],
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderRadius: 9,
                    padding: '6px 4px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    maxWidth: 108,
                  }}
                >
                  {isOwner && p.userId && <option value="owner">{ROLE_LABEL.owner}</option>}
                  <option value="admin">{ROLE_LABEL.admin}</option>
                  <option value="member">{ROLE_LABEL.member}</option>
                </select>
              ) : (
                <span
                  data-role-of={p.name}
                  style={{
                    ...ROLE_STYLE[role],
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderRadius: 9,
                    padding: '6px 8px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ROLE_LABEL[role]}
                </span>
              )}

              <div style={{ position: 'relative', visibility: canManage ? 'visible' : 'hidden' }}>
                <button
                  onClick={() => setMenuPlayerId(menuPlayerId === p.id ? null : p.id)}
                  aria-label={`Tùy chọn cho ${p.name}`}
                  style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: 2, display: 'flex' }}
                >
                  <MoreVertical size={18} />
                </button>

                {menuPlayerId === p.id && (
                  <>
                    <div onClick={() => setMenuPlayerId(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      zIndex: 41,
                      background: '#ffffff',
                      border: '1px solid #e8eef0',
                      borderRadius: 12,
                      boxShadow: '0 10px 28px rgba(15, 23, 42, 0.16)',
                      padding: 4,
                    }}>
                      {isOwner && p.userId && role !== 'owner' && (
                        <button
                          style={menuItemStyle}
                          onClick={() => {
                            changeRole(p, 'owner');
                            setMenuPlayerId(null);
                          }}
                        >
                          <Crown size={15} color="#f59e0b" />
                          <span>Đặt làm chủ CLB</span>
                        </button>
                      )}
                      {role !== 'admin' && (
                        <button
                          style={menuItemStyle}
                          onClick={() => {
                            changeRole(p, 'admin');
                            setMenuPlayerId(null);
                          }}
                        >
                          <ShieldCheck size={15} color="#2563eb" />
                          <span>Đặt làm quản trị viên</span>
                        </button>
                      )}
                      {role !== 'member' && (
                        <button
                          style={menuItemStyle}
                          onClick={() => {
                            changeRole(p, 'member');
                            setMenuPlayerId(null);
                          }}
                        >
                          <User size={15} color="#64748b" />
                          <span>Chuyển thành thành viên</span>
                        </button>
                      )}
                      <button style={{ ...menuItemStyle, color: '#dc2626' }} onClick={() => handleRemove(p)}>
                        <Trash2 size={15} />
                        <span>Xóa thành viên</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {visiblePlayers.length === 0 && (
          <div style={{ padding: 18, textAlign: 'center', fontSize: '0.82rem', color: '#94a3b8' }}>
            Không tìm thấy thành viên nào.
          </div>
        )}
      </MobileCard>

      {/* 3. DANGER ZONE */}
      {isOwner && <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: '#fff5f5',
        border: '1px solid #fecaca',
        borderRadius: 18,
        padding: 14,
      }}>
        <Trash2 size={22} color="#dc2626" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#dc2626' }}>Xóa CLB</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', lineHeight: 1.4 }}>
            Xóa toàn bộ dữ liệu CLB, bao gồm lịch thi đấu, thành viên và thống kê.
          </div>
        </div>
        <button
          onClick={handleDeleteClub}
          style={{
            border: '1.5px solid #f87171',
            background: '#ffffff',
            color: '#dc2626',
            borderRadius: 12,
            padding: '8px 16px',
            fontSize: '0.82rem',
            fontWeight: 800,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Xóa CLB
        </button>
      </div>}
    </MobilePage>
  );
};
