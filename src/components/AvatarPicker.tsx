import React, { useRef, useState } from 'react';
import { RefreshCw, Upload } from 'lucide-react';
import { happyAvatar } from '../utils/playerStats';

interface AvatarPickerProps {
  // Avatar currently shown for the account (already saved or just picked)
  value: string;
  // Makes the suggested faces different for every account
  seed: string;
  onChange: (avatar: string) => void;
}

const SUGGESTION_COUNT = 8;
const UPLOAD_SIZE = 160;
// Keep in step with the server's limit for uploaded avatars
const MAX_UPLOAD_LENGTH = 80000;

// Center-crops the chosen photo to a small square JPEG so it can be stored with the account
async function resizeToAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = UPLOAD_SIZE;
  canvas.height = UPLOAD_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh');
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    UPLOAD_SIZE,
    UPLOAD_SIZE
  );
  bitmap.close();

  for (const quality of [0.85, 0.7, 0.5]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_UPLOAD_LENGTH) return dataUrl;
  }
  throw new Error('Ảnh quá lớn, hãy chọn ảnh khác');
}

const pillButtonStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  color: '#334155',
  fontSize: '0.78rem',
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export const AvatarPicker: React.FC<AvatarPickerProps> = ({ value, seed, onChange }) => {
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const suggestions = Array.from({ length: SUGGESTION_COUNT }, (_, i) => happyAvatar(`${seed}-${page}-${i}`));

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      onChange(await resizeToAvatar(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đọc được ảnh này');
    }
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        {suggestions.map((url, index) => {
          const selected = url === value;
          return (
            <button
              key={url}
              type="button"
              onClick={() => onChange(url)}
              aria-label={`Chọn ảnh đại diện ${index + 1}`}
              aria-pressed={selected}
              style={{
                padding: 4,
                borderRadius: 14,
                border: selected ? '2px solid #10b981' : '2px solid transparent',
                background: selected ? '#ecfdf5' : '#f4f6f8',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <img src={url} alt="" style={{ width: '100%', maxWidth: 64, aspectRatio: '1', borderRadius: '50%', background: '#e0f2fe' }} />
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button type="button" onClick={() => setPage((p) => p + 1)} style={pillButtonStyle}>
          <RefreshCw size={14} />
          <span>Xem hình khác</span>
        </button>
        <button type="button" onClick={() => fileInput.current?.click()} style={pillButtonStyle}>
          <Upload size={14} />
          <span>Tải ảnh của bạn</span>
        </button>
        <input ref={fileInput} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      </div>

      {error && (
        <div role="alert" style={{ fontSize: '0.76rem', color: '#b91c1c', marginTop: 8 }}>{error}</div>
      )}
    </div>
  );
};
