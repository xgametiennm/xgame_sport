import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Wallet,
  Download,
  Settings,
  QrCode,
  X,
} from 'lucide-react';
import { usePickleball } from '../context/PickleballContext';
import { api } from '../services/api';
import { FundCampaign, FundClaim, FundExpense, FundExpenseCategory, FundLogEntry, FundOverview, FundReceipt, Player } from '../types/pickleball';
import { categoryLabel, defaultPeriod, EXPENSE_CATEGORIES, FundPeriod, inRange, periodRange } from '../utils/fundPeriod';
import { PeriodPicker } from './fund/PeriodPicker';
import { FundReport } from './fund/FundReport';
import { ClaimRow, FundSettingsForm, PaymentInfoCard, PayModal } from './fund/Payments';
import { Avatar } from './MobileUi';
import { exportFundToExcel } from '../utils/fundExport';

import {
  cardStyle,
  errorText,
  formatDay,
  formatVnd,
  inputStyle,
  labelStyle,
  MoneyInput,
  parseVnd,
  prepareReceipt,
  primaryButton,
  smallButton,
  SummaryCard,
  todayInput,
} from './fund/shared';

// ---------------------------------------------------------------------------
// Collection rounds

const CampaignForm: React.FC<{
  initial?: FundCampaign;
  onSave: (input: { name: string; amountPerMember: number; dueDate: string | null; note: string }) => Promise<void>;
  onCancel: () => void;
}> = ({ initial, onSave, onCancel }) => {
  const [name, setName] = useState(initial?.name || '');
  const [amount, setAmount] = useState(initial ? String(initial.amountPerMember) : '');
  const [dueDate, setDueDate] = useState(initial?.dueDate || '');
  const [note, setNote] = useState(initial?.note || '');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountPerMember = parseVnd(amount) ?? 0;
    setBusy(true);
    try {
      await onSave({ name: name.trim(), amountPerMember, dueDate: dueDate || null, note: note.trim() });
    } catch (err) {
      window.alert(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ ...cardStyle, display: 'grid', gap: 10, borderColor: '#10b981' }}>
      <div style={{ fontWeight: 900, fontSize: '0.92rem', color: '#0f172a' }}>{initial ? 'Sửa đợt thu' : 'Tạo đợt thu quỹ'}</div>
      <div>
        <label style={labelStyle}>Tên đợt thu</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Quỹ tháng 11/2026" style={inputStyle} required autoFocus />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <div>
          <label style={labelStyle}>Số tiền mỗi người</label>
          <MoneyInput value={amount} onChange={setAmount} />
        </div>
        <div>
          <label style={labelStyle}>Hạn đóng (tuỳ chọn)</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Ghi chú (tuỳ chọn)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="VD: Chuyển khoản STK ... - ghi rõ họ tên" />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={smallButton('#f1f5f9', '#475569')}>Hủy</button>
        <button type="submit" disabled={busy} style={{ ...primaryButton, opacity: busy ? 0.6 : 1 }}>{busy ? 'Đang lưu...' : 'Lưu đợt thu'}</button>
      </div>
    </form>
  );
};

// Inline editor for what one member paid
const PaymentEditor: React.FC<{
  defaultAmount: number;
  initial?: { amount: number; paidAt: string; note: string };
  onSave: (payment: { amount: number; paidAt: string; note: string }) => Promise<void>;
  onCancel: () => void;
}> = ({ defaultAmount, initial, onSave, onCancel }) => {
  const [amount, setAmount] = useState(String(initial?.amount ?? (defaultAmount || '')));
  const [paidAt, setPaidAt] = useState(initial?.paidAt || todayInput());
  const [note, setNote] = useState(initial?.note || '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const value = parseVnd(amount);
    if (!value) {
      window.alert('Vui lòng nhập số tiền đã đóng');
      return;
    }
    setBusy(true);
    try {
      await onSave({ amount: value, paidAt, note: note.trim() });
    } catch (err) {
      window.alert(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6, padding: '8px 0 4px' }}>
      <MoneyInput value={amount} onChange={setAmount} autoFocus />
      <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} style={inputStyle} />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú (CK / tiền mặt...)" style={inputStyle} />
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <button type="button" onClick={save} disabled={busy} style={{ ...primaryButton, padding: '9px 12px' }}>Lưu</button>
        <button type="button" onClick={onCancel} style={{ ...smallButton('#f1f5f9', '#475569'), padding: '9px 12px' }}>Hủy</button>
      </div>
    </div>
  );
};

// Opens the VietQR / "I have transferred" dialog for one member and round
type PayHandler = (campaign: FundCampaign, player: Player, owed: number) => void;

const CampaignCard: React.FC<{
  campaign: FundCampaign;
  members: Player[];
  playerById: Map<string, Player>;
  canEdit: boolean;
  myPlayerId?: string;
  pendingClaims: FundClaim[];
  onPay: PayHandler;
  onChanged: () => Promise<void>;
}> = ({ campaign, members, playerById, canEdit, myPlayerId, pendingClaims, onPay, onChanged }) => {
  const { selectedClub } = usePickleball();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);

  const paidBy = new Map(campaign.contributions.map((c) => [c.playerId, c]));
  const unpaid = members.filter((p) => !paidBy.has(p.id));
  const collected = campaign.contributions.reduce((sum, c) => sum + c.amount, 0);
  const expected = campaign.amountPerMember * (campaign.contributions.length + unpaid.length);
  const progress = expected > 0 ? Math.min(100, Math.round((collected / expected) * 100)) : 0;
  const overdue = !!campaign.dueDate && campaign.dueDate < todayInput() && unpaid.length > 0;

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      await onChanged();
    } catch (err) {
      window.alert(errorText(err));
    }
  };

  const savePayment = (playerId: string) => async (payment: { amount: number; paidAt: string; note: string }) => {
    await api.setFundContribution(selectedClub.id, campaign.id, playerId, payment);
    setEditingPlayer(null);
    await onChanged();
  };

  if (editing) {
    return (
      <CampaignForm
        initial={campaign}
        onCancel={() => setEditing(false)}
        onSave={async (input) => {
          await api.saveFundCampaign(selectedClub.id, input, campaign.id);
          setEditing(false);
          await onChanged();
        }}
      />
    );
  }

  const memberRow = (playerId: string, content: React.ReactNode, actions: React.ReactNode) => {
    const player = playerById.get(playerId);
    return (
      <div key={playerId} style={{ padding: '7px 0', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {player ? <Avatar player={player} size={28} /> : <span style={{ width: 28 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {player ? player.name : 'Thành viên đã rời CLB'}
            </div>
            {content}
          </div>
          {actions}
        </div>
        {editingPlayer === playerId && (
          <PaymentEditor
            defaultAmount={campaign.amountPerMember}
            initial={paidBy.get(playerId)}
            onSave={savePayment(playerId)}
            onCancel={() => setEditingPlayer(null)}
          />
        )}
      </div>
    );
  };

  return (
    <div style={cardStyle}>
      <div onClick={() => setOpen(!open)} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#0f172a' }}>{campaign.name}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
              {formatVnd(campaign.amountPerMember)}/người
              {campaign.dueDate && <> · Hạn <span style={{ color: overdue ? '#dc2626' : undefined, fontWeight: overdue ? 800 : undefined }}>{formatDay(campaign.dueDate)}</span></>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, color: '#64748b' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#047857' }}>
              {campaign.contributions.length}/{campaign.contributions.length + unpaid.length} đã đóng
            </span>
            {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
        <div style={{ height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden', margin: '8px 0 4px' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: '#10b981', borderRadius: 999 }} />
        </div>
        <div style={{ fontSize: '0.74rem', color: '#475569' }}>
          Đã thu <strong style={{ color: '#047857' }}>{formatVnd(collected)}</strong>
          {expected > 0 && <> / {formatVnd(expected)}</>}
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          {campaign.note && (
            <div style={{ fontSize: '0.76rem', color: '#475569', background: '#f8fafc', borderRadius: 10, padding: '8px 10px', marginBottom: 8, whiteSpace: 'pre-wrap' }}>
              {campaign.note}
            </div>
          )}

          <div style={{ fontSize: '0.74rem', fontWeight: 900, color: '#047857', marginTop: 6 }}>ĐÃ ĐÓNG ({campaign.contributions.length})</div>
          {campaign.contributions.map((c) =>
            memberRow(
              c.playerId,
              <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                {formatDay(c.paidAt)}{c.note ? ` · ${c.note}` : ''}{c.recordedByName ? ` · ghi bởi ${c.recordedByName}` : ''}
              </div>,
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ textAlign: 'right' }}>
                  <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 900, color: '#047857', whiteSpace: 'nowrap' }}>{formatVnd(c.amount)}</span>
                  {c.amount < campaign.amountPerMember && (
                    <span style={{ display: 'block', fontSize: '0.66rem', fontWeight: 800, color: '#dc2626', whiteSpace: 'nowrap' }}>
                      thiếu {formatVnd(campaign.amountPerMember - c.amount)}
                    </span>
                  )}
                </span>
                {c.playerId === myPlayerId && c.amount < campaign.amountPerMember && !pendingClaims.some((x) => x.playerId === c.playerId) && playerById.get(c.playerId) && (
                  <button
                    type="button"
                    onClick={() => onPay(campaign, playerById.get(c.playerId)!, campaign.amountPerMember - c.amount)}
                    style={smallButton('#047857', '#ffffff')}
                  >
                    <QrCode size={13} /> Đóng bù
                  </button>
                )}
                {canEdit && (
                  <>
                    <button type="button" onClick={() => setEditingPlayer(c.playerId)} title="Sửa" aria-label="Sửa" style={smallButton('#f1f5f9', '#475569')}>
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      title="Bỏ ghi nhận"
                      aria-label="Bỏ ghi nhận"
                      onClick={() => {
                        const name = playerById.get(c.playerId)?.name || 'thành viên này';
                        if (window.confirm(`Bỏ ghi nhận ${name} đã đóng ${formatVnd(c.amount)}?`)) {
                          run(() => api.deleteFundContribution(selectedClub.id, campaign.id, c.playerId));
                        }
                      }}
                      style={smallButton('#fef2f2', '#dc2626')}
                    >
                      <X size={13} />
                    </button>
                  </>
                )}
              </div>
            )
          )}

          <div style={{ fontSize: '0.74rem', fontWeight: 900, color: '#b45309', marginTop: 12 }}>CHƯA ĐÓNG ({unpaid.length})</div>
          {unpaid.map((p) => {
            const pending = pendingClaims.find((c) => c.playerId === p.id);
            const isMe = p.id === myPlayerId;
            return memberRow(
              p.id,
              pending ? (
                <div style={{ fontSize: '0.68rem', color: '#b45309', fontWeight: 700 }}>Đã báo chuyển {formatVnd(pending.amount)} · chờ xác nhận</div>
              ) : null,
              editingPlayer !== p.id ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {isMe && !pending && (
                    <button type="button" onClick={() => onPay(campaign, p, campaign.amountPerMember)} style={smallButton('#047857', '#ffffff')}>
                      <QrCode size={13} /> Đóng quỹ
                    </button>
                  )}
                  {canEdit && !isMe && campaign.amountPerMember > 0 && (
                    <button type="button" onClick={() => onPay(campaign, p, campaign.amountPerMember)} title="Hiện mã QR cho thành viên quét" style={smallButton('#f1f5f9', '#475569')}>
                      <QrCode size={13} />
                    </button>
                  )}
                  {canEdit && (
                    <button type="button" onClick={() => setEditingPlayer(p.id)} style={smallButton('#ecfdf5', '#047857')}>
                      <Plus size={13} /> Ghi nhận đã đóng
                    </button>
                  )}
                </div>
              ) : null
            );
          })}
          {unpaid.length === 0 && <div style={{ fontSize: '0.76rem', color: '#94a3b8', padding: '6px 0' }}>Mọi người đã đóng đủ 🎉</div>}

          {canEdit && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" onClick={() => setEditing(true)} style={smallButton('#f1f5f9', '#475569')}>
                <Pencil size={13} /> Sửa đợt thu
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Xóa đợt thu "${campaign.name}" cùng ${campaign.contributions.length} khoản đã đóng? Tổng quỹ sẽ giảm ${formatVnd(collected)}.`)) {
                    run(() => api.deleteFundCampaign(selectedClub.id, campaign.id));
                  }
                }}
                style={smallButton('#fef2f2', '#dc2626')}
              >
                <Trash2 size={13} /> Xóa đợt thu
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Expenses

const ReceiptPicker: React.FC<{ files: File[]; onChange: (files: File[]) => void }> = ({ files, onChange }) => (
  <div>
    <label style={{ ...smallButton('#eff6ff', '#1d4ed8'), padding: '8px 12px' }}>
      <Paperclip size={14} /> Chọn ảnh / PDF hóa đơn
      <input
        type="file"
        accept="image/*,application/pdf"
        multiple
        onChange={(e) => {
          onChange([...files, ...Array.from(e.target.files || [])]);
          e.target.value = '';
        }}
        style={{ display: 'none' }}
      />
    </label>
    {files.length > 0 && (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
        {files.map((f, i) => (
          <span key={`${f.name}-${i}`} style={{ ...smallButton('#f1f5f9', '#334155'), fontWeight: 600 }}>
            {f.name.length > 24 ? `${f.name.slice(0, 21)}...` : f.name}
            <X size={12} style={{ cursor: 'pointer' }} onClick={() => onChange(files.filter((_, j) => j !== i))} />
          </span>
        ))}
      </div>
    )}
  </div>
);

const uploadReceipts = async (clubId: string, expenseId: string, files: File[]) => {
  const failed: string[] = [];
  for (const file of files) {
    try {
      await api.uploadFundReceipt(clubId, expenseId, await prepareReceipt(file));
    } catch (err) {
      failed.push(`${file.name}: ${errorText(err)}`);
    }
  }
  if (failed.length) window.alert(`Không tải lên được:\n${failed.join('\n')}`);
};

const ExpenseForm: React.FC<{
  initial?: FundExpense;
  onDone: () => Promise<void>;
  onCancel: () => void;
}> = ({ initial, onDone, onCancel }) => {
  const { selectedClub } = usePickleball();
  const [title, setTitle] = useState(initial?.title || '');
  const [category, setCategory] = useState<FundExpenseCategory>(initial?.category || 'other');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [spentAt, setSpentAt] = useState(initial?.spentAt || todayInput());
  const [note, setNote] = useState(initial?.note || '');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseVnd(amount);
    if (!value) {
      window.alert('Vui lòng nhập số tiền chi');
      return;
    }
    setBusy(true);
    try {
      const id = await api.saveFundExpense(selectedClub.id, { title: title.trim(), category, amount: value, spentAt, note: note.trim() }, initial?.id);
      await uploadReceipts(selectedClub.id, id, files);
      await onDone();
    } catch (err) {
      window.alert(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ ...cardStyle, display: 'grid', gap: 10, borderColor: '#10b981' }}>
      <div style={{ fontWeight: 900, fontSize: '0.92rem', color: '#0f172a' }}>{initial ? 'Sửa khoản chi' : 'Thêm khoản chi'}</div>
      <div>
        <label style={labelStyle}>Nội dung chi</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Mua 2 hộp bóng, thuê sân tháng 11" style={inputStyle} required autoFocus />
      </div>
      <div>
        <label style={labelStyle}>Danh mục</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              aria-pressed={category === c.value}
              style={{ ...smallButton(category === c.value ? '#0d5e46' : '#f1f5f9', category === c.value ? '#ffffff' : '#475569'), padding: '7px 12px' }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <div>
          <label style={labelStyle}>Số tiền</label>
          <MoneyInput value={amount} onChange={setAmount} />
        </div>
        <div>
          <label style={labelStyle}>Ngày chi</label>
          <input type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} style={inputStyle} required />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Ghi chú</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Chi tiết: mua ở đâu, ai trả, chia cho những việc gì..." />
      </div>
      <div>
        <label style={labelStyle}>Hóa đơn {initial ? '(thêm)' : ''}</label>
        <ReceiptPicker files={files} onChange={setFiles} />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={smallButton('#f1f5f9', '#475569')}>Hủy</button>
        <button type="submit" disabled={busy} style={{ ...primaryButton, opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Đang lưu...' : 'Lưu khoản chi'}
        </button>
      </div>
    </form>
  );
};

const ReceiptThumb: React.FC<{ receipt: FundReceipt; url: string; onOpen: () => void; onDelete?: () => void }> = ({ receipt, url, onOpen, onDelete }) => {
  const isImage = receipt.mime.startsWith('image/');
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onOpen}
        title={receipt.fileName}
        style={{
          width: 64,
          height: 64,
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          background: '#f8fafc',
          padding: 0,
          overflow: 'hidden',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isImage ? (
          <img src={url} alt={receipt.fileName} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#dc2626', fontSize: '0.6rem', fontWeight: 800 }}>
            <FileText size={22} /> PDF
          </span>
        )}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Xóa ${receipt.fileName}`}
          style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: '#dc2626', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
};

const ExpenseCard: React.FC<{
  expense: FundExpense;
  canEdit: boolean;
  onChanged: () => Promise<void>;
  onOpenImage: (url: string) => void;
}> = ({ expense, canEdit, onChanged, onOpenImage }) => {
  const { selectedClub } = usePickleball();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      await onChanged();
    } catch (err) {
      window.alert(errorText(err));
    }
  };

  if (editing) {
    return (
      <ExpenseForm
        initial={expense}
        onCancel={() => setEditing(false)}
        onDone={async () => {
          setEditing(false);
          await onChanged();
        }}
      />
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
            {expense.title}
            <span style={{ ...smallButton('#f1f5f9', '#475569'), cursor: 'default', padding: '2px 8px', fontSize: '0.64rem', marginLeft: 6, verticalAlign: 'middle' }}>
              {categoryLabel(expense.category)}
            </span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
            {formatDay(expense.spentAt)}{expense.createdByName ? ` · ghi bởi ${expense.createdByName}` : ''}
          </div>
        </div>
        <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#dc2626', whiteSpace: 'nowrap' }}>−{formatVnd(expense.amount)}</div>
      </div>

      {expense.note && (
        <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: 6, whiteSpace: 'pre-wrap' }}>{expense.note}</div>
      )}

      {(expense.receipts.length > 0 || canEdit) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10, alignItems: 'center' }}>
          {expense.receipts.map((r) => {
            const url = api.fundReceiptUrl(selectedClub.id, r.id);
            return (
              <ReceiptThumb
                key={r.id}
                receipt={r}
                url={url}
                onOpen={() => (r.mime.startsWith('image/') ? onOpenImage(url) : window.open(url, '_blank', 'noopener'))}
                onDelete={canEdit ? () => {
                  if (window.confirm(`Xóa hóa đơn "${r.fileName}"?`)) run(() => api.deleteFundReceipt(selectedClub.id, r.id));
                } : undefined}
              />
            );
          })}
          {canEdit && (
            <label style={{ ...smallButton('#eff6ff', '#1d4ed8'), opacity: adding ? 0.6 : 1 }}>
              <Paperclip size={13} /> {adding ? 'Đang tải...' : 'Thêm hóa đơn'}
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                disabled={adding}
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  e.target.value = '';
                  if (!files.length) return;
                  setAdding(true);
                  await uploadReceipts(selectedClub.id, expense.id, files);
                  setAdding(false);
                  await onChanged();
                }}
              />
            </label>
          )}
        </div>
      )}

      {canEdit && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
          <button type="button" onClick={() => setEditing(true)} style={smallButton('#f1f5f9', '#475569')}>
            <Pencil size={13} /> Sửa
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Xóa khoản chi "${expense.title}" (${formatVnd(expense.amount)}) và hóa đơn kèm theo?`)) {
                run(() => api.deleteFundExpense(selectedClub.id, expense.id));
              }
            }}
            style={smallButton('#fef2f2', '#dc2626')}
          >
            <Trash2 size={13} /> Xóa
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// What each member still owes across all rounds

interface DebtLine {
  campaign: FundCampaign;
  paid: number;
  owed: number;
  overdue: boolean;
}

interface MemberDebt {
  player: Player;
  lines: DebtLine[];
  total: number;
}

// Every current member is expected to pay each round in full; a round asking 0 ₫ is voluntary
function computeDebts(campaigns: FundCampaign[], members: Player[], overdueOnly: boolean): MemberDebt[] {
  const today = todayInput();
  return members
    .map((player) => {
      const lines = campaigns
        .filter((c) => c.amountPerMember > 0)
        .map((c) => {
          const paid = c.contributions.find((x) => x.playerId === player.id)?.amount ?? 0;
          return { campaign: c, paid, owed: c.amountPerMember - paid, overdue: !!c.dueDate && c.dueDate < today };
        })
        .filter((line) => line.owed > 0 && (!overdueOnly || line.overdue));
      return { player, lines, total: lines.reduce((sum, line) => sum + line.owed, 0) };
    })
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total || a.player.name.localeCompare(b.player.name, 'vi'));
}

const DebtList: React.FC<{
  campaigns: FundCampaign[];
  members: Player[];
  myPlayerId?: string;
  canEdit: boolean;
  onPay: PayHandler;
  onChanged: () => Promise<void>;
}> = ({ campaigns, members, myPlayerId, canEdit, onPay, onChanged }) => {
  const { selectedClub } = usePickleball();
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const debts = useMemo(() => computeDebts(campaigns, members, overdueOnly), [campaigns, members, overdueOnly]);
  const query = search.trim().toLowerCase();
  const visible = query ? debts.filter((d) => d.player.name.toLowerCase().includes(query)) : debts;
  const grandTotal = debts.reduce((sum, d) => sum + d.total, 0);

  // Records the round as paid in full (keeping what was already paid in the total)
  const payInFull = async (player: Player, line: DebtLine) => {
    if (!window.confirm(`Ghi nhận ${player.name} đã đóng đủ "${line.campaign.name}" (${formatVnd(line.campaign.amountPerMember)})?`)) return;
    try {
      await api.setFundContribution(selectedClub.id, line.campaign.id, player.id, {
        amount: line.campaign.amountPerMember,
        paidAt: todayInput(),
        note: line.paid > 0 ? `Đóng bù ${formatVnd(line.owed)}` : '',
      });
      await onChanged();
    } catch (err) {
      window.alert(errorText(err));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>Tổng còn thiếu{overdueOnly ? ' (đợt đã quá hạn)' : ''}</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#dc2626' }}>{formatVnd(grandTotal)}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{debts.length} người chưa đóng đủ</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: 3, borderRadius: 10, gap: 3 }}>
            {([
              { value: false, label: 'Tất cả đợt' },
              { value: true, label: 'Đã quá hạn' },
            ] as const).map((opt) => (
              <button
                key={opt.label}
                onClick={() => setOverdueOnly(opt.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: overdueOnly === opt.value ? '#ffffff' : 'transparent',
                  color: overdueOnly === opt.value ? '#0f172a' : '#64748b',
                  boxShadow: overdueOnly === opt.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm thành viên..." style={{ ...inputStyle, width: 170 }} />
        </div>
      </div>

      {visible.map((d) => {
        const open = openId === d.player.id;
        return (
          <div key={d.player.id} style={{ ...cardStyle, padding: '10px 14px', borderColor: d.player.id === myPlayerId ? '#fca5a5' : '#e8eef0' }}>
            <div onClick={() => setOpenId(open ? null : d.player.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <Avatar player={d.player} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {d.player.name}{d.player.id === myPlayerId ? ' (bạn)' : ''}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  {d.lines.length} đợt chưa đủ{d.lines.some((l) => l.overdue) ? ' · có đợt quá hạn' : ''}
                </div>
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#dc2626', whiteSpace: 'nowrap' }}>{formatVnd(d.total)}</div>
              {open ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
            </div>

            {open && d.lines.map((line) => (
              <div key={line.campaign.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 2px', borderTop: '1px solid #f1f5f9', marginTop: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>{line.campaign.name}</div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                    {line.paid > 0 ? `Đã đóng ${formatVnd(line.paid)} / ${formatVnd(line.campaign.amountPerMember)}` : `Chưa đóng · ${formatVnd(line.campaign.amountPerMember)}`}
                    {line.campaign.dueDate && (
                      <> · Hạn <span style={{ color: line.overdue ? '#dc2626' : undefined, fontWeight: line.overdue ? 800 : undefined }}>{formatDay(line.campaign.dueDate)}</span></>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#dc2626', whiteSpace: 'nowrap' }}>{formatVnd(line.owed)}</span>
                {d.player.id === myPlayerId && (
                  <button type="button" onClick={() => onPay(line.campaign, d.player, line.owed)} style={smallButton('#047857', '#ffffff')}>
                    <QrCode size={13} /> Đóng
                  </button>
                )}
                {canEdit && (
                  <button type="button" onClick={() => payInFull(d.player, line)} style={smallButton('#ecfdf5', '#047857')}>
                    Ghi nhận đủ
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {visible.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem' }}>
          {debts.length === 0 ? 'Không ai còn thiếu quỹ 🎉' : 'Không tìm thấy thành viên nào.'}
        </div>
      )}

      <div style={{ fontSize: '0.68rem', color: '#94a3b8', padding: '0 4px' }}>
        Tính trên các thành viên hiện tại của CLB, mỗi đợt thu phải đóng đủ số tiền/người của đợt đó.
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Screen

// ---------------------------------------------------------------------------
// Change log

const LOG_TONE: Record<string, { color: string; background: string; label: string }> = {
  create: { color: '#047857', background: '#ecfdf5', label: 'Thêm' },
  update: { color: '#1d4ed8', background: '#eff6ff', label: 'Sửa' },
  delete: { color: '#dc2626', background: '#fef2f2', label: 'Xóa' },
  approve: { color: '#047857', background: '#ecfdf5', label: 'Xác nhận' },
  reject: { color: '#b45309', background: '#fffbeb', label: 'Từ chối' },
};

const LOG_TARGET: Record<FundLogEntry['targetType'], string> = {
  campaign: 'Đợt thu',
  contribution: 'Đóng quỹ',
  expense: 'Chi tiêu',
  receipt: 'Hóa đơn',
  settings: 'Cài đặt',
  claim: 'Báo chuyển khoản',
};

const PAGE = 100;

const FundLog: React.FC<{ clubId: string }> = ({ clubId }) => {
  const [entries, setEntries] = useState<FundLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<'all' | FundLogEntry['targetType']>('all');

  useEffect(() => {
    let cancelled = false;
    api.getFundLogs(clubId)
      .then((list) => {
        if (cancelled) return;
        setEntries(list);
        setHasMore(list.length >= PAGE);
      })
      .catch((err) => !cancelled && setError(errorText(err)));
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const loadMore = async () => {
    if (!entries?.length) return;
    setLoadingMore(true);
    try {
      const older = await api.getFundLogs(clubId, entries[entries.length - 1].createdAt);
      setEntries([...entries, ...older]);
      setHasMore(older.length >= PAGE);
    } catch (err) {
      window.alert(errorText(err));
    } finally {
      setLoadingMore(false);
    }
  };

  if (error) return <div style={{ ...cardStyle, color: '#b91c1c', textAlign: 'center' }}>{error}</div>;
  if (!entries) return <div style={{ ...cardStyle, color: '#64748b', textAlign: 'center' }}>Đang tải nhật ký...</div>;

  const visible = filter === 'all' ? entries : entries.filter((e) => e.targetType === filter);
  const dayOf = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(['all', 'contribution', 'claim', 'campaign', 'expense', 'receipt', 'settings'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            style={{
              ...smallButton(filter === value ? '#0d5e46' : '#f1f5f9', filter === value ? '#ffffff' : '#475569'),
              padding: '6px 12px',
            }}
          >
            {value === 'all' ? 'Tất cả' : LOG_TARGET[value]}
          </button>
        ))}
      </div>

      <div style={cardStyle}>
        {visible.map((entry, index) => {
          const tone = LOG_TONE[entry.action.split('.')[1]] || LOG_TONE.update;
          const newDay = index === 0 || dayOf(visible[index - 1].createdAt) !== dayOf(entry.createdAt);
          return (
            <React.Fragment key={entry.id}>
              {newDay && (
                <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#64748b', textTransform: 'capitalize', padding: index === 0 ? '0 0 6px' : '12px 0 6px' }}>
                  {dayOf(entry.createdAt)}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: newDay ? 'none' : '1px solid #f1f5f9' }}>
                <span style={{ ...smallButton(tone.background, tone.color), cursor: 'default', alignSelf: 'flex-start', padding: '3px 8px', fontSize: '0.66rem' }}>
                  {tone.label}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 600 }}>{entry.summary}</div>
                  {entry.changes.length > 0 && (
                    <div style={{ marginTop: 4, display: 'grid', gap: 2 }}>
                      {entry.changes.map((c) => (
                        <div key={c.field} style={{ fontSize: '0.74rem', color: '#475569' }}>
                          {c.field}: <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{c.from}</span>
                          {' → '}<strong style={{ color: '#0f172a' }}>{c.to}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 3 }}>
                    {entry.actorName} · {new Date(entry.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {LOG_TARGET[entry.targetType]}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {visible.length === 0 && (
          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem', padding: 12 }}>Chưa có thay đổi nào được ghi lại.</div>
        )}
      </div>

      {hasMore && (
        <button onClick={loadMore} disabled={loadingMore} style={{ ...smallButton('#f1f5f9', '#475569'), alignSelf: 'center', padding: '8px 16px' }}>
          {loadingMore ? 'Đang tải...' : 'Xem thêm thay đổi cũ hơn'}
        </button>
      )}
    </div>
  );
};

type FundTab = 'campaigns' | 'expenses' | 'debts' | 'report' | 'log';

export const FundManager: React.FC = () => {
  const { selectedClub, players, isManager, myPlayer } = usePickleball();
  const [fund, setFund] = useState<FundOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<FundTab>('campaigns');
  const [creating, setCreating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [period, setPeriod] = useState<FundPeriod>(defaultPeriod);
  const [categoryFilter, setCategoryFilter] = useState<'all' | FundExpenseCategory>('all');
  const [payTarget, setPayTarget] = useState<{ campaign: FundCampaign; player: Player; owed: number } | null>(null);

  const clubId = selectedClub.id;
  const [logVersion, setLogVersion] = useState(0);
  const reload = useCallback(async () => {
    try {
      setLogVersion((v) => v + 1);
      setFund(await api.getFund(clubId));
      setLoadError(null);
    } catch (err) {
      setLoadError(errorText(err));
    }
  }, [clubId]);

  useEffect(() => {
    let cancelled = false;
    api.getFund(clubId)
      .then((data) => {
        if (!cancelled) {
          setFund(data);
          setLoadError(null);
        }
      })
      .catch((err) => !cancelled && setLoadError(errorText(err)));
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const members = useMemo(() => [...players].sort((a, b) => a.name.localeCompare(b.name, 'vi')), [players]);
  const debtorCount = useMemo(() => (fund ? computeDebts(fund.campaigns, members, false).length : 0), [fund, members]);
  const range = useMemo(() => periodRange(period), [period]);
  const visibleExpenses = useMemo(
    () => (fund ? fund.expenses.filter((e) => inRange(e.spentAt, range) && (categoryFilter === 'all' || e.category === categoryFilter)) : []),
    [fund, range, categoryFilter]
  );
  const myDebts = useMemo(
    () => (fund && myPlayer ? computeDebts(fund.campaigns, [myPlayer], false)[0]?.lines || [] : []),
    [fund, myPlayer]
  );
  const pendingClaims = useMemo(() => (fund ? fund.claims.filter((c) => c.status === 'pending') : []), [fund]);
  const campaignName = (id: string) => fund?.campaigns.find((c) => c.id === id)?.name || 'đã xóa';
  const onPay: PayHandler = (campaign, player, owed) => setPayTarget({ campaign, player, owed });

  const exportExcel = async (withRange: boolean) => {
    if (!fund) return;
    setExporting(true);
    try {
      await exportFundToExcel(fund, members, playerById, selectedClub.name, withRange ? range : undefined);
    } catch (err) {
      window.alert(errorText(err));
    } finally {
      setExporting(false);
    }
  };

  const switchTab = (next: FundTab) => {
    setTab(next);
    setCreating(false);
  };

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '18px 14px 90px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Wallet size={24} color="#047857" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>Quỹ CLB</h1>
          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
            {selectedClub.name}{isManager ? '' : ' · chỉ xem (quản trị viên ghi thu chi)'}
          </div>
        </div>
        {fund && isManager && (
          <button type="button" onClick={() => setEditingSettings(!editingSettings)} title="Số dư đầu kỳ, tài khoản nhận tiền" style={{ ...smallButton('#ffffff', '#475569'), border: '1.5px solid #e2e8f0', padding: '8px 10px' }}>
            <Settings size={15} /> Cài đặt
          </button>
        )}
        {fund && (
          <button
            type="button"
            disabled={exporting}
            title="Tải file Excel toàn bộ: tổng quan, sổ thu chi, thu quỹ, chi tiêu, còn thiếu"
            onClick={() => exportExcel(false)}
            style={{ ...smallButton('#ffffff', '#047857'), border: '1.5px solid #10b981', padding: '8px 12px', opacity: exporting ? 0.6 : 1 }}
          >
            <Download size={15} /> {exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
        )}
      </div>

      {loadError && !fund && (
        <div style={{ ...cardStyle, textAlign: 'center', color: '#b91c1c' }}>
          {loadError}
          <div><button onClick={reload} style={{ ...smallButton('#f1f5f9', '#475569'), marginTop: 8 }}>Thử lại</button></div>
        </div>
      )}
      {!fund && !loadError && <div style={{ ...cardStyle, textAlign: 'center', color: '#64748b' }}>Đang tải quỹ...</div>}

      {fund && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
            <SummaryCard label="Tổng quỹ hiện tại" amount={fund.totals.balance} color={fund.totals.balance >= 0 ? '#047857' : '#dc2626'} icon={<Wallet size={26} />} big />
            {fund.totals.opening !== 0 && (
              <SummaryCard
                label={`Số dư đầu kỳ${fund.settings.openingDate ? ` (${formatDay(fund.settings.openingDate)})` : ''}`}
                amount={fund.totals.opening}
                color="#475569"
                icon={<Wallet size={22} />}
              />
            )}
            <SummaryCard label="Tổng đã thu" amount={fund.totals.income} color="#0f766e" icon={<ArrowDownCircle size={22} />} />
            <SummaryCard label="Tổng đã chi" amount={fund.totals.expense} color="#dc2626" icon={<ArrowUpCircle size={22} />} />
          </div>

          {editingSettings && (
            <div style={{ marginBottom: 16 }}>
              <FundSettingsForm
                settings={fund.settings}
                onQrChanged={reload}
                onCancel={() => setEditingSettings(false)}
                onSaved={async () => {
                  setEditingSettings(false);
                  await reload();
                }}
              />
            </div>
          )}

          {!editingSettings && (
            <PaymentInfoCard
              settings={fund.settings}
              canEdit={isManager}
              onOpenImage={setImageUrl}
              onOpenSettings={() => setEditingSettings(true)}
            />
          )}

          {/* Managers: transfers members reported, waiting to be confirmed */}
          {isManager && pendingClaims.length > 0 && (
            <div style={{ ...cardStyle, borderColor: '#fcd34d', background: '#fffdf5', marginBottom: 16 }}>
              <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#92400e' }}>Chờ xác nhận chuyển khoản ({pendingClaims.length})</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 4 }}>Kiểm tra tiền đã về tài khoản rồi bấm Xác nhận: khoản đóng được cộng vào quỹ ngay.</div>
              {pendingClaims.map((c) => (
                <ClaimRow key={c.id} claim={c} campaignName={campaignName(c.campaignId)} player={playerById.get(c.playerId)} canReview canCancel onChanged={reload} onOpenImage={setImageUrl} />
              ))}
            </div>
          )}

          {/* A member's own share: what they still owe, and their recent reports */}
          {myPlayer && (myDebts.length > 0 || fund.claims.some((c) => c.playerId === myPlayer.id && c.status !== 'approved')) && (
            <div style={{ ...cardStyle, borderColor: '#a7f3d0', marginBottom: 16 }}>
              <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#0f172a', marginBottom: 4 }}>Phần của bạn</div>
              {myDebts.map((line) => {
                const pending = fund.claims.some((c) => c.playerId === myPlayer.id && c.campaignId === line.campaign.id && c.status === 'pending');
                return (
                  <div key={line.campaign.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>{line.campaign.name}</div>
                      <div style={{ fontSize: '0.7rem', color: line.overdue ? '#dc2626' : '#64748b' }}>
                        Còn thiếu {formatVnd(line.owed)}{line.campaign.dueDate ? ` · hạn ${formatDay(line.campaign.dueDate)}` : ''}
                      </div>
                    </div>
                    {pending ? (
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#b45309' }}>Chờ xác nhận</span>
                    ) : (
                      <button type="button" onClick={() => onPay(line.campaign, myPlayer, line.owed)} style={smallButton('#047857', '#ffffff')}>
                        <QrCode size={13} /> Đóng quỹ
                      </button>
                    )}
                  </div>
                );
              })}
              {fund.claims.filter((c) => c.playerId === myPlayer.id && c.status !== 'approved').slice(0, 5).map((c) => (
                <ClaimRow key={c.id} claim={c} campaignName={campaignName(c.campaignId)} player={myPlayer} canReview={false} canCancel onChanged={reload} onOpenImage={setImageUrl} />
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ display: 'inline-flex', flexWrap: 'wrap', background: '#f1f5f9', padding: 4, borderRadius: 12, gap: 4 }}>
              {([
                { value: 'campaigns', label: `Đợt thu (${fund.campaigns.length})` },
                { value: 'expenses', label: `Chi tiêu (${fund.expenses.length})` },
                { value: 'debts', label: `Còn thiếu (${debtorCount})` },
                { value: 'report', label: 'Báo cáo' },
                { value: 'log', label: 'Nhật ký' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => switchTab(opt.value)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 9,
                    border: 'none',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    background: tab === opt.value ? '#0d5e46' : 'transparent',
                    color: tab === opt.value ? '#ffffff' : '#64748b',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {isManager && !creating && (tab === 'campaigns' || tab === 'expenses') && (
              <button onClick={() => setCreating(true)} style={primaryButton}>
                <Plus size={15} strokeWidth={3} /> {tab === 'campaigns' ? 'Tạo đợt thu' : 'Thêm khoản chi'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {creating && tab === 'campaigns' && (
              <CampaignForm
                onCancel={() => setCreating(false)}
                onSave={async (input) => {
                  await api.saveFundCampaign(clubId, input);
                  setCreating(false);
                  await reload();
                }}
              />
            )}
            {creating && tab === 'expenses' && (
              <ExpenseForm
                onCancel={() => setCreating(false)}
                onDone={async () => {
                  setCreating(false);
                  await reload();
                }}
              />
            )}

            {tab === 'campaigns' && fund.campaigns.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                members={members}
                playerById={playerById}
                canEdit={isManager}
                myPlayerId={myPlayer?.id}
                pendingClaims={pendingClaims.filter((x) => x.campaignId === c.id)}
                onPay={onPay}
                onChanged={reload}
              />
            ))}
            {/* Re-read after every change, so the newest entry is always there */}
            {tab === 'log' && <FundLog key={logVersion} clubId={clubId} />}

            {tab === 'debts' && (
              <DebtList campaigns={fund.campaigns} members={members} myPlayerId={myPlayer?.id} canEdit={isManager} onPay={onPay} onChanged={reload} />
            )}

            {tab === 'campaigns' && fund.campaigns.length === 0 && !creating && (
              <div style={{ ...cardStyle, textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem' }}>
                Chưa có đợt thu nào.{isManager ? ' Bấm "Tạo đợt thu" để bắt đầu.' : ''}
              </div>
            )}

            {(tab === 'expenses' || tab === 'report') && (
              <div style={{ ...cardStyle, padding: '10px 12px', display: 'grid', gap: 8 }}>
                <PeriodPicker value={period} onChange={setPeriod} />
                {tab === 'expenses' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    {([{ value: 'all', label: 'Tất cả danh mục' }, ...EXPENSE_CATEGORIES] as const).map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setCategoryFilter(c.value)}
                        aria-pressed={categoryFilter === c.value}
                        style={{ ...smallButton(categoryFilter === c.value ? '#0d5e46' : '#f1f5f9', categoryFilter === c.value ? '#ffffff' : '#475569'), padding: '5px 10px' }}
                      >
                        {c.label}
                      </button>
                    ))}
                    <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#475569' }}>
                      {visibleExpenses.length} khoản · <strong style={{ color: '#dc2626' }}>{formatVnd(visibleExpenses.reduce((sum, e) => sum + e.amount, 0))}</strong> ({range.label})
                    </span>
                  </div>
                )}
              </div>
            )}

            {tab === 'report' && (
              <FundReport fund={fund} playerById={playerById} range={range} onExport={() => exportExcel(true)} exporting={exporting} />
            )}

            {tab === 'expenses' && visibleExpenses.map((e) => (
              <ExpenseCard key={e.id} expense={e} canEdit={isManager} onChanged={reload} onOpenImage={setImageUrl} />
            ))}
            {tab === 'expenses' && visibleExpenses.length === 0 && !creating && (
              <div style={{ ...cardStyle, textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem' }}>
                <Receipt size={22} style={{ marginBottom: 4 }} />
                <div>{fund.expenses.length === 0 ? 'Chưa có khoản chi nào.' : 'Không có khoản chi nào trong kỳ / danh mục này.'}</div>
              </div>
            )}
          </div>
        </>
      )}

      {payTarget && fund && (
        <PayModal
          campaign={payTarget.campaign}
          player={payTarget.player}
          owed={payTarget.owed}
          settings={fund.settings}
          canReport={payTarget.player.id === myPlayer?.id}
          onClose={() => setPayTarget(null)}
          onReported={reload}
        />
      )}

      {imageUrl && (
        <div
          onClick={() => setImageUrl(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15, 23, 42, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <img src={imageUrl} alt="Hóa đơn" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12, background: '#ffffff' }} />
          <button
            onClick={() => setImageUrl(null)}
            aria-label="Đóng"
            style={{ position: 'fixed', top: 16, right: 16, width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
};
