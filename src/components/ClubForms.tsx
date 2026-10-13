import React, { useState } from 'react';
import { LogIn, Plus } from 'lucide-react';
import { NewClubInput } from '../services/api';

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 700,
  color: '#334155',
  marginBottom: 6,
};

const FormError: React.FC<{ message: string }> = ({ message }) => (
  <div role="alert" style={{
    fontSize: '0.82rem',
    color: '#b91c1c',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 10,
    padding: '8px 12px',
  }}>
    {message}
  </div>
);

const submitStyle = (disabled: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  opacity: disabled ? 0.6 : 1,
});

// Runs a form submission, exposing its pending state and the server's error message
function useSubmit() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (action: () => Promise<unknown>) => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác không thành công');
    } finally {
      setSubmitting(false);
    }
  };

  return { submitting, error, submit };
}

export const CreateClubForm: React.FC<{ onSubmit: (input: NewClubInput) => Promise<unknown> }> = ({ onSubmit }) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [courtsCount, setCourtsCount] = useState(4);
  const { submitting, error, submit } = useSubmit();

  const disabled = submitting || !name.trim() || !location.trim();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(() => onSubmit({ name: name.trim(), location: location.trim(), description: description.trim(), courtsCount }));
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <div>
        <label htmlFor="club-name" style={labelStyle}>Tên CLB</label>
        <input
          id="club-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-light"
          placeholder="VD: CLB Pickleball Cầu Giấy"
          maxLength={255}
          required
        />
      </div>

      <div>
        <label htmlFor="club-location" style={labelStyle}>Địa điểm</label>
        <input
          id="club-location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="input-light"
          placeholder="VD: Hà Nội, Việt Nam"
          maxLength={255}
          required
        />
      </div>

      <div>
        <label htmlFor="club-description" style={labelStyle}>Mô tả (tuỳ chọn)</label>
        <textarea
          id="club-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input-light"
          rows={2}
          style={{ resize: 'vertical' }}
        />
      </div>

      <div>
        <label htmlFor="club-courts" style={labelStyle}>Số sân đấu</label>
        <input
          id="club-courts"
          type="number"
          min={1}
          max={50}
          value={courtsCount}
          onChange={(e) => setCourtsCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
          className="input-light"
          required
        />
      </div>

      {error && <FormError message={error} />}

      <button type="submit" className="btn-court" disabled={disabled} style={submitStyle(disabled)}>
        <Plus size={18} strokeWidth={3} />
        <span>{submitting ? 'Đang tạo...' : 'Tạo CLB'}</span>
      </button>
    </form>
  );
};

export const JoinClubForm: React.FC<{ onSubmit: (code: string) => Promise<unknown> }> = ({ onSubmit }) => {
  const [code, setCode] = useState('');
  const { submitting, error, submit } = useSubmit();

  const disabled = submitting || !code.trim();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(() => onSubmit(code.trim()));
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <div>
        <label htmlFor="club-join-code" style={labelStyle}>Mã tham gia CLB</label>
        <input
          id="club-join-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="input-light mono"
          placeholder="VD: XGAB12CD"
          maxLength={16}
          autoCapitalize="characters"
          autoComplete="off"
          style={{ fontWeight: 800, letterSpacing: '0.08em' }}
          required
        />
        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 6 }}>
          Chủ CLB hoặc quản trị viên có mã này trong phần Cài đặt CLB.
        </div>
      </div>

      {error && <FormError message={error} />}

      <button type="submit" className="btn-court" disabled={disabled} style={submitStyle(disabled)}>
        <LogIn size={18} />
        <span>{submitting ? 'Đang tham gia...' : 'Tham gia CLB'}</span>
      </button>
    </form>
  );
};
