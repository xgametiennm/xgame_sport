import React from 'react';
import { useAuth } from '../context/AuthContext';
import { usePickleball } from '../context/PickleballContext';
import { Crown, X } from 'lucide-react';
import { CreateClubForm, JoinClubForm } from './ClubForms';

interface ClubModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Called once the new/joined club is selected
  onDone: () => void;
}

const ModalShell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  onClose,
  children,
}) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>{title}</h2>
        <button
          onClick={onClose}
          aria-label="Đóng"
          style={{
            background: '#f1f5f9',
            border: 'none',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export const OwnerNotice: React.FC<{ name: string }> = ({ name }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: 14,
    padding: '10px 12px',
    marginBottom: 16,
  }}>
    <Crown size={20} color="#f59e0b" fill="#fbbf24" style={{ flexShrink: 0 }} />
    <div style={{ fontSize: '0.8rem', color: '#78350f', lineHeight: 1.4 }}>
      <strong>{name}</strong> sẽ là chủ CLB với toàn quyền quản trị.
    </div>
  </div>
);

export const CreateClubModal: React.FC<ClubModalProps> = ({ isOpen, onClose, onDone }) => {
  const { currentUser } = useAuth();
  const { createClub } = usePickleball();

  if (!isOpen || !currentUser) return null;

  return (
    <ModalShell title="Tạo câu lạc bộ mới" onClose={onClose}>
      <OwnerNotice name={currentUser.name} />
      <CreateClubForm onSubmit={async (input) => { await createClub(input); onDone(); }} />
    </ModalShell>
  );
};

export const JoinClubModal: React.FC<ClubModalProps> = ({ isOpen, onClose, onDone }) => {
  const { joinClub } = usePickleball();

  if (!isOpen) return null;

  return (
    <ModalShell title="Tham gia câu lạc bộ" onClose={onClose}>
      <JoinClubForm onSubmit={async (code) => { await joinClub(code); onDone(); }} />
    </ModalShell>
  );
};
