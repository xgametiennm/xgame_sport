import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Paperclip, QrCode, Trash2, Upload, X } from 'lucide-react';
import { usePickleball } from '../../context/PickleballContext';
import { api } from '../../services/api';
import { FundCampaign, FundClaim, FundSettings, Player } from '../../types/pickleball';
import { buildVietQrPayload, transferDescription, VIETQR_BANKS } from '../../utils/vietqr';
import { Avatar } from '../MobileUi';
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
  todayInput,
} from './shared';

// ---------------------------------------------------------------------------
// Opening balance and the account members transfer to (managers)

const OTHER_BANK = 'other';

// A QR picture is kept as it is when small (re-encoding could blur the code); large photos are shrunk
async function readQrPicture(file: File): Promise<{ fileName: string; mime: string; data: string }> {
  if (file.size > 2.5 * 1024 * 1024) return prepareReceipt(file);
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Không đọc được ảnh'));
    reader.readAsDataURL(file);
  });
  return { fileName: file.name, mime: file.type, data };
}

// Upload, replace or remove the treasurer's own payment QR picture (saved immediately)
const QrPictureField: React.FC<{ settings: FundSettings; onChanged: () => Promise<void> }> = ({ settings, onChanged }) => {
  const { selectedClub } = usePickleball();
  const [busy, setBusy] = useState(false);
  const version = settings.qrImageVersion;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      await onChanged();
    } catch (err) {
      window.alert(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ width: 110, height: 110, borderRadius: 12, border: '1.5px dashed #cbd5e1', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
        {version ? (
          <img src={api.fundQrUrl(selectedClub.id, version)} alt="Mã QR nhận tiền quỹ" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#ffffff' }} />
        ) : (
          <QrCode size={36} color="#cbd5e1" />
        )}
      </div>
      <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
        <div style={{ fontSize: '0.74rem', color: '#64748b', maxWidth: 360 }}>
          Lưu ảnh mã QR nhận tiền từ app ngân hàng, MoMo hoặc ZaloPay rồi tải lên đây. Mọi thành viên sẽ thấy để quét.
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <label style={{ ...smallButton('#eff6ff', '#1d4ed8'), padding: '8px 12px', opacity: busy ? 0.6 : 1 }}>
            <Upload size={14} /> {busy ? 'Đang tải...' : version ? 'Thay ảnh QR' : 'Tải ảnh QR lên'}
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) run(async () => api.uploadFundQr(selectedClub.id, await readQrPicture(file)));
              }}
            />
          </label>
          {version && (
            <button
              type="button"
              disabled={busy}
              onClick={() => window.confirm('Xóa ảnh mã QR nhận tiền?') && run(() => api.deleteFundQr(selectedClub.id))}
              style={smallButton('#fef2f2', '#dc2626')}
            >
              <Trash2 size={13} /> Xóa ảnh
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const FundSettingsForm: React.FC<{
  settings: FundSettings;
  onSaved: () => Promise<void>;
  // The QR picture is saved on its own, without closing the form
  onQrChanged: () => Promise<void>;
  onCancel: () => void;
}> = ({ settings, onSaved, onQrChanged, onCancel }) => {
  const { selectedClub } = usePickleball();
  const known = VIETQR_BANKS.some((b) => b.bin === settings.bankBin);
  const [opening, setOpening] = useState(String(settings.openingBalance || ''));
  const [openingDate, setOpeningDate] = useState(settings.openingDate || '');
  const [bankChoice, setBankChoice] = useState(settings.bankBin ? (known ? settings.bankBin : OTHER_BANK) : '');
  const [customBin, setCustomBin] = useState(known ? '' : settings.bankBin);
  const [customName, setCustomName] = useState(known ? '' : settings.bankName);
  const [accountNo, setAccountNo] = useState(settings.accountNo);
  const [accountName, setAccountName] = useState(settings.accountName);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const negative = opening.trim().startsWith('-');
    const value = parseVnd(opening) ?? 0;
    const bankBin = bankChoice === OTHER_BANK ? customBin.trim() : bankChoice;
    const bankName = bankChoice === OTHER_BANK ? customName.trim() : VIETQR_BANKS.find((b) => b.bin === bankChoice)?.name || '';
    setBusy(true);
    try {
      await api.saveFundSettings(selectedClub.id, {
        openingBalance: negative ? -value : value,
        openingDate: openingDate || null,
        bankBin,
        bankName,
        accountNo: accountNo.trim(),
        accountName: accountName.trim(),
      });
      await onSaved();
    } catch (err) {
      window.alert(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ ...cardStyle, display: 'grid', gap: 12, borderColor: '#10b981' }}>
      <div style={{ fontWeight: 900, fontSize: '0.92rem', color: '#0f172a' }}>Cài đặt quỹ</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <div>
          <label style={labelStyle}>Số dư đầu kỳ (tiền quỹ đã có trước khi dùng app)</label>
          <MoneyInput value={opening} onChange={setOpening} placeholder="VD: 5000000 hoặc 5000k" />
        </div>
        <div>
          <label style={labelStyle}>Tính từ ngày</label>
          <input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginTop: 4 }}>Ảnh mã QR nhận tiền của thủ quỹ</div>
      <QrPictureField settings={settings} onChanged={onQrChanged} />

      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
        Tài khoản ngân hàng nhận tiền <span style={{ fontWeight: 500, color: '#64748b' }}>(để tự tạo mã VietQR có sẵn số tiền và nội dung cho từng người)</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <div>
          <label style={labelStyle}>Ngân hàng</label>
          <select value={bankChoice} onChange={(e) => setBankChoice(e.target.value)} style={inputStyle}>
            <option value="">— Chưa cài —</option>
            {VIETQR_BANKS.map((b) => <option key={b.bin} value={b.bin}>{b.name}</option>)}
            <option value={OTHER_BANK}>Ngân hàng khác (nhập mã BIN)</option>
          </select>
        </div>
        {bankChoice === OTHER_BANK && (
          <>
            <div>
              <label style={labelStyle}>Mã BIN ngân hàng (6 số)</label>
              <input value={customBin} onChange={(e) => setCustomBin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="VD: 970436" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Tên ngân hàng</label>
              <input value={customName} onChange={(e) => setCustomName(e.target.value)} style={inputStyle} />
            </div>
          </>
        )}
        <div>
          <label style={labelStyle}>Số tài khoản</label>
          <input value={accountNo} onChange={(e) => setAccountNo(e.target.value.replace(/\s/g, ''))} inputMode="numeric" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Chủ tài khoản</label>
          <input value={accountName} onChange={(e) => setAccountName(e.target.value.toUpperCase())} placeholder="NGUYEN VAN A" style={inputStyle} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={smallButton('#f1f5f9', '#475569')}>Hủy</button>
        <button type="submit" disabled={busy} style={{ ...primaryButton, opacity: busy ? 0.6 : 1 }}>{busy ? 'Đang lưu...' : 'Lưu cài đặt'}</button>
      </div>
    </form>
  );
};

// ---------------------------------------------------------------------------
// Paying a round: VietQR code, then "Tôi đã chuyển khoản"

const CopyRow: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderTop: '1px solid #f1f5f9' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a', wordBreak: 'break-all' }}>{value}</div>
      </div>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // clipboard unavailable
          }
        }}
        aria-label={`Sao chép ${label}`}
        style={smallButton('#f1f5f9', '#475569')}
      >
        {copied ? <Check size={14} color="#047857" /> : <Copy size={14} />}
      </button>
    </div>
  );
};

export const PayModal: React.FC<{
  campaign: FundCampaign;
  player: Player;
  owed: number;
  settings: FundSettings;
  // Only the member themselves can report their transfer; managers just show the code
  canReport: boolean;
  onClose: () => void;
  onReported: () => Promise<void>;
}> = ({ campaign, player, owed, settings, canReport, onClose, onReported }) => {
  const { selectedClub } = usePickleball();
  const [amount, setAmount] = useState(String(owed || campaign.amountPerMember || ''));
  const [transferredAt, setTransferredAt] = useState(todayInput());
  const [note, setNote] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const value = parseVnd(amount) || 0;
  const description = transferDescription(`${player.name} ${campaign.name}`);
  const hasBank = settings.bankBin.length === 6 && !!settings.accountNo;
  const pictureUrl = settings.qrImageVersion ? api.fundQrUrl(selectedClub.id, settings.qrImageVersion) : null;
  // The generated code fills in amount and description; the uploaded picture does not
  const [qrKind, setQrKind] = useState<'generated' | 'picture'>(hasBank ? 'generated' : 'picture');
  const payload = useMemo(
    () => (hasBank ? buildVietQrPayload({ bin: settings.bankBin, accountNo: settings.accountNo, amount: value || undefined, description }) : ''),
    [hasBank, settings.bankBin, settings.accountNo, value, description]
  );

  const report = async () => {
    if (!value) {
      window.alert('Vui lòng nhập số tiền đã chuyển');
      return;
    }
    setBusy(true);
    try {
      await api.createFundClaim(selectedClub.id, campaign.id, {
        amount: value,
        transferredAt,
        note: note.trim(),
        proof: proof ? await prepareReceipt(proof) : undefined,
      });
      await onReported();
      onClose();
    } catch (err) {
      window.alert(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...cardStyle, width: '100%', maxWidth: 420, margin: '24px auto', padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: '1rem', color: '#0f172a' }}>Đóng quỹ: {campaign.name}</div>
            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
              {player.name} · {owed > 0 ? `còn thiếu ${formatVnd(owed)}` : `${formatVnd(campaign.amountPerMember)}/người`}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" style={smallButton('#f1f5f9', '#475569')}><X size={16} /></button>
        </div>

        {hasBank && pictureUrl && (
          <div style={{ display: 'inline-flex', justifySelf: 'center', background: '#f1f5f9', padding: 3, borderRadius: 10, gap: 3 }}>
            {([
              { value: 'generated', label: 'VietQR (có sẵn số tiền)' },
              { value: 'picture', label: 'Mã QR của thủ quỹ' },
            ] as const).map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setQrKind(k.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: qrKind === k.value ? '#ffffff' : 'transparent',
                  color: qrKind === k.value ? '#0f172a' : '#64748b',
                  boxShadow: qrKind === k.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {k.label}
              </button>
            ))}
          </div>
        )}

        {(hasBank || pictureUrl) ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              {hasBank && qrKind === 'generated' ? (
                <div style={{ background: '#ffffff', padding: 10, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <QRCodeSVG value={payload} size={208} level="M" />
                </div>
              ) : (
                <img src={pictureUrl!} alt="Mã QR nhận tiền quỹ" style={{ width: 240, maxWidth: '100%', borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }} />
              )}
              <div style={{ fontSize: '0.72rem', color: '#64748b', textAlign: 'center' }}>
                {hasBank && qrKind === 'generated'
                  ? 'Mở app ngân hàng, quét mã: số tiền và nội dung đã điền sẵn.'
                  : `Quét mã rồi nhập số tiền ${value ? formatVnd(value) : ''} và nội dung bên dưới.`}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Số tiền chuyển (sửa nếu chuyển khác)</label>
              <MoneyInput value={amount} onChange={setAmount} />
            </div>
            <div>
              {hasBank && <CopyRow label={settings.bankName || 'Ngân hàng'} value={settings.accountNo} />}
              {hasBank && settings.accountName && <CopyRow label="Chủ tài khoản" value={settings.accountName} />}
              <CopyRow label="Nội dung chuyển khoản" value={description} />
            </div>
          </>
        ) : (
          <div style={{ fontSize: '0.8rem', color: '#b45309', background: '#fffbeb', borderRadius: 10, padding: '10px 12px' }}>
            Thủ quỹ chưa cài mã QR / tài khoản nhận tiền. Bạn vẫn có thể báo đã đóng (chuyển khoản hoặc tiền mặt).
          </div>
        )}

        {canReport && (
          <div style={{ display: 'grid', gap: 8, borderTop: '1px dashed #cbd5e1', paddingTop: 12 }}>
            <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0f172a' }}>Đã chuyển xong? Báo để quản trị viên xác nhận</div>
            {!hasBank && !pictureUrl && (
              <div>
                <label style={labelStyle}>Số tiền đã đóng</label>
                <MoneyInput value={amount} onChange={setAmount} />
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={labelStyle}>Ngày chuyển</label>
                <input type="date" value={transferredAt} onChange={(e) => setTransferredAt(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Ghi chú</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="CK / tiền mặt..." style={inputStyle} />
              </div>
            </div>
            <label style={{ ...smallButton('#eff6ff', '#1d4ed8'), justifySelf: 'start', padding: '8px 12px' }}>
              <Paperclip size={14} /> {proof ? proof.name.slice(0, 28) : 'Đính kèm ảnh chuyển khoản (nên có)'}
              <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => setProof(e.target.files?.[0] || null)} />
            </label>
            <button type="button" onClick={report} disabled={busy} style={{ ...primaryButton, justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Đang gửi...' : `Tôi đã chuyển ${value ? formatVnd(value) : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// "Đóng quỹ – Quét mã QR": the club's payment details, always on the fund page

export const PaymentInfoCard: React.FC<{
  settings: FundSettings;
  canEdit: boolean;
  onOpenImage: (url: string) => void;
  onOpenSettings: () => void;
}> = ({ settings, canEdit, onOpenImage, onOpenSettings }) => {
  const { selectedClub, myPlayer } = usePickleball();
  const hasBank = settings.bankBin.length === 6 && !!settings.accountNo;
  const pictureUrl = settings.qrImageVersion ? api.fundQrUrl(selectedClub.id, settings.qrImageVersion) : null;
  const generated = useMemo(
    () => (hasBank ? buildVietQrPayload({ bin: settings.bankBin, accountNo: settings.accountNo }) : ''),
    [hasBank, settings.bankBin, settings.accountNo]
  );

  if (!hasBank && !pictureUrl) {
    if (!canEdit) return null;
    return (
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12, borderStyle: 'dashed', marginBottom: 16 }}>
        <QrCode size={28} color="#94a3b8" />
        <div style={{ flex: 1, fontSize: '0.8rem', color: '#475569' }}>
          Chưa có mã QR nhận tiền. Tải ảnh QR của thủ quỹ hoặc nhập tài khoản ngân hàng để thành viên quét đóng quỹ.
        </div>
        <button type="button" onClick={onOpenSettings} style={primaryButton}>Cài mã QR</button>
      </div>
    );
  }

  const tile = (content: React.ReactNode, caption: string, onClick?: () => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <button
        type="button"
        onClick={onClick}
        style={{ background: '#ffffff', padding: 6, borderRadius: 12, border: '1px solid #e2e8f0', cursor: onClick ? 'zoom-in' : 'default' }}
      >
        {content}
      </button>
      <span style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: 700 }}>{caption}</span>
    </div>
  );

  return (
    <div style={{ ...cardStyle, borderColor: '#a7f3d0', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
          <QrCode size={18} color="#047857" /> Đóng quỹ – Quét mã QR
        </div>
        {canEdit && <button type="button" onClick={onOpenSettings} style={smallButton('#f1f5f9', '#475569')}>Sửa</button>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {pictureUrl && tile(
            <img src={pictureUrl} alt="Mã QR nhận tiền quỹ" style={{ width: 150, height: 150, objectFit: 'contain', display: 'block' }} />,
            'Mã QR của thủ quỹ',
            () => onOpenImage(pictureUrl)
          )}
          {hasBank && tile(<QRCodeSVG value={generated} size={150} level="M" />, 'VietQR')}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          {hasBank && <CopyRow label={settings.bankName || 'Ngân hàng'} value={settings.accountNo} />}
          {hasBank && settings.accountName && <CopyRow label="Chủ tài khoản" value={settings.accountName} />}
          <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: 8, lineHeight: 1.5 }}>
            Nội dung chuyển khoản: <strong>Họ tên – Tên đợt</strong>
            {myPlayer && <> (VD: <em>{transferDescription(`${myPlayer.name} Quy thang`)}</em>)</>}.
            <br />
            Chuyển xong, bấm <strong>Đóng quỹ</strong> ở đợt cần đóng để báo cho thủ quỹ xác nhận. Nút <strong>Đóng quỹ</strong> còn có mã QR điền sẵn đúng số tiền.
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Reports waiting for a manager, and a member's own reports

const STATUS: Record<FundClaim['status'], { label: string; color: string; background: string }> = {
  pending: { label: 'Chờ xác nhận', color: '#b45309', background: '#fffbeb' },
  approved: { label: 'Đã xác nhận', color: '#047857', background: '#ecfdf5' },
  rejected: { label: 'Bị từ chối', color: '#b91c1c', background: '#fef2f2' },
};

export const ClaimRow: React.FC<{
  claim: FundClaim;
  campaignName: string;
  player?: Player;
  canReview: boolean;
  canCancel: boolean;
  onChanged: () => Promise<void>;
  onOpenImage: (url: string) => void;
}> = ({ claim, campaignName, player, canReview, canCancel, onChanged, onOpenImage }) => {
  const { selectedClub } = usePickleball();
  const [busy, setBusy] = useState(false);
  const status = STATUS[claim.status];
  const proofUrl = claim.proofMime ? api.fundClaimProofUrl(selectedClub.id, claim.id) : null;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      await onChanged();
    } catch (err) {
      window.alert(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 10, padding: '9px 0', borderTop: '1px solid #f1f5f9', alignItems: 'flex-start' }}>
      {player ? <Avatar player={player} size={32} /> : <span style={{ width: 32 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.84rem', color: '#0f172a' }}>
          <strong>{player ? player.name : 'Thành viên đã rời CLB'}</strong> báo đã chuyển <strong>{formatVnd(claim.amount)}</strong>
        </div>
        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
          Đợt "{campaignName}" · ngày {formatDay(claim.transferredAt)}{claim.note ? ` · ${claim.note}` : ''}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 5 }}>
          <span style={{ ...smallButton(status.background, status.color), cursor: 'default', padding: '3px 8px', fontSize: '0.66rem' }}>{status.label}</span>
          {claim.status !== 'pending' && claim.reviewedByName && (
            <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>bởi {claim.reviewedByName}{claim.reviewNote ? `: ${claim.reviewNote}` : ''}</span>
          )}
          {proofUrl && (
            <button
              type="button"
              onClick={() => (claim.proofMime?.startsWith('image/') ? onOpenImage(proofUrl) : window.open(proofUrl, '_blank', 'noopener'))}
              style={smallButton('#eff6ff', '#1d4ed8')}
            >
              <Paperclip size={12} /> Ảnh chuyển khoản
            </button>
          )}
        </div>
      </div>
      {claim.status === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {canReview && (
            <>
              <button type="button" disabled={busy} onClick={() => run(() => api.approveFundClaim(selectedClub.id, claim.id))} style={smallButton('#047857', '#ffffff')}>
                <Check size={13} /> Xác nhận
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const reason = window.prompt('Lý do từ chối (người báo sẽ nhận được):', 'Chưa thấy tiền về tài khoản');
                  if (reason !== null) run(() => api.rejectFundClaim(selectedClub.id, claim.id, reason));
                }}
                style={smallButton('#fef2f2', '#dc2626')}
              >
                Từ chối
              </button>
            </>
          )}
          {canCancel && !canReview && (
            <button
              type="button"
              disabled={busy}
              onClick={() => window.confirm('Hủy báo chuyển khoản này?') && run(() => api.cancelFundClaim(selectedClub.id, claim.id))}
              style={smallButton('#f1f5f9', '#475569')}
            >
              Hủy
            </button>
          )}
        </div>
      )}
    </div>
  );
};
