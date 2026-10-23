import React from 'react';

// Helpers, styles and small inputs shared by the club fund screens.

// ---------------------------------------------------------------------------
// Helpers

export const formatVnd = (amount: number): string => `${amount.toLocaleString('vi-VN')} ₫`;

// "200.000", "200000" or "200k" → 200000
export const parseVnd = (input: string): number | null => {
  const clean = input.trim().toLowerCase();
  if (!clean) return null;
  const thousands = clean.endsWith('k');
  const digits = clean.replace(/[^\d]/g, '');
  if (!digits) return null;
  const value = parseInt(digits, 10) * (thousands ? 1000 : 1);
  return Number.isSafeInteger(value) ? value : null;
};

export const todayInput = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const formatDay = (day: string | null): string => {
  if (!day) return '';
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
};

export const errorText = (err: unknown): string => (err instanceof Error ? err.message : 'Thao tác không thành công');

export const MAX_IMAGE_SIDE = 1600;

// Photos are shrunk before upload (phone pictures are often 5–10MB); PDFs and GIFs go as they are
export async function prepareReceipt(file: File): Promise<{ fileName: string; mime: string; data: string }> {
  let blob: Blob = file;
  let mime = file.type || 'application/octet-stream';
  let fileName = file.name;

  if (/^image\/(jpeg|png|webp)$/.test(mime)) {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff'; // transparent PNG areas would turn black in JPEG
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
        if (jpeg && jpeg.size < file.size) {
          blob = jpeg;
          mime = 'image/jpeg';
          fileName = fileName.replace(/\.[^.]+$/, '') + '.jpg';
        }
      }
      bitmap.close();
    } catch {
      // the browser cannot decode it: send the original
    }
  }

  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Không đọc được tệp'));
    reader.readAsDataURL(blob);
  });
  return { fileName, mime, data };
}

// ---------------------------------------------------------------------------
// Small building blocks

export const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e8eef0',
  borderRadius: 16,
  padding: 14,
  boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
};

export const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '9px 11px',
  borderRadius: 10,
  border: '1.5px solid #e2e8f0',
  fontSize: '0.86rem',
  background: '#ffffff',
  outline: 'none',
};

export const labelStyle: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: 4, display: 'block' };

export const smallButton = (background: string, color: string): React.CSSProperties => ({
  border: 'none',
  borderRadius: 8,
  padding: '6px 10px',
  background,
  color,
  fontSize: '0.74rem',
  fontWeight: 800,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  whiteSpace: 'nowrap',
});

export const primaryButton: React.CSSProperties = {
  ...smallButton('linear-gradient(135deg, #10b981, #047857)', '#ffffff'),
  padding: '9px 14px',
  fontSize: '0.82rem',
};

export const MoneyInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }> = ({
  value,
  onChange,
  placeholder,
  autoFocus,
}) => {
  const parsed = parseVnd(value);
  return (
    <div>
      <input
        inputMode="numeric"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'VD: 200000 hoặc 200k'}
        style={inputStyle}
      />
      {parsed !== null && value.trim() && (
        <div style={{ fontSize: '0.68rem', color: '#047857', marginTop: 2, fontWeight: 700 }}>{formatVnd(parsed)}</div>
      )}
    </div>
  );
};

export const SummaryCard: React.FC<{ label: string; amount: number; color: string; icon: React.ReactNode; big?: boolean }> = ({
  label,
  amount,
  color,
  icon,
  big,
}) => (
  <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
    <div style={{ color, display: 'flex', flexShrink: 0 }}>{icon}</div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: big ? '1.35rem' : '1rem', fontWeight: 900, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {formatVnd(amount)}
      </div>
    </div>
  </div>
);
