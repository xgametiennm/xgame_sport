import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePickleball } from '../context/PickleballContext';
import { getDuprTier } from '../utils/duprCalculator';
import { happyAvatar } from '../utils/playerStats';
import { AvatarPicker } from './AvatarPicker';
import { 
  X, 
  LogOut
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, logout } = useAuth();
  const { lang, selectedClub, myPlayer, updateMyProfile } = usePickleball();

  const [name, setName] = useState<string>(currentUser?.name || '');
  const [doublesRating, setDoublesRating] = useState<number>(myPlayer?.doublesRating || 3.5);
  const [singlesRating, setSinglesRating] = useState<number>(myPlayer?.singlesRating || 3.2);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  // Set once the user picks a different avatar; sent with the next save
  const [pickedAvatar, setPickedAvatar] = useState<string | null>(null);

  if (!isOpen || !currentUser) return null;

  const avatar = pickedAvatar || currentUser.avatar || happyAvatar(currentUser.email);
  const tier = getDuprTier(myPlayer?.doublesRating || doublesRating);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMyProfile(name, doublesRating, singlesRating, pickedAvatar ?? undefined);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Không lưu được thay đổi');
      return;
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>
            {lang === 'vi' ? 'Hồ Sơ Vận Động Viên' : 'Player Profile'}
          </h2>
          <button
            onClick={onClose}
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

        {/* Profile Card Header (Light Court Style) */}
        <div style={{
          background: '#f8fafc',
          borderRadius: 20,
          padding: 20,
          marginBottom: 20,
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          <img
            src={avatar}
            alt={currentUser.name}
            style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid #059669' }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>{currentUser.name}</h3>
              <span className="badge badge-court">{tier.nameVi}</span>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 2 }}>
              {currentUser.email}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700, marginTop: 4 }}>
              CLB: {selectedClub.name}
            </div>
          </div>
        </div>

        {/* Form to edit details */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Ảnh đại diện:
            </div>
            <AvatarPicker value={avatar} seed={currentUser.id} onChange={setPickedAvatar} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Tên hiển thị:
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-dark"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                DUPR Đôi (Doubles):
              </label>
              <input
                type="number"
                step="0.001"
                min="2.000"
                max="8.000"
                value={doublesRating}
                onChange={(e) => setDoublesRating(parseFloat(e.target.value) || 2.0)}
                className="input-dark mono"
                style={{ fontWeight: 800, color: '#059669' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                DUPR Đơn (Singles):
              </label>
              <input
                type="number"
                step="0.001"
                min="2.000"
                max="8.000"
                value={singlesRating}
                onChange={(e) => setSinglesRating(parseFloat(e.target.value) || 2.0)}
                className="input-dark mono"
                style={{ fontWeight: 800, color: '#0284c7' }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-court"
            style={{ width: '100%', marginTop: 6, padding: '12px' }}
          >
            {isSaved ? '✓ Đã Lưu Thành Công!' : 'Lưu Thay Đổi'}
          </button>
        </form>

        {/* Logout button */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
          <button
            type="button"
            onClick={() => {
              logout();
              onClose();
            }}
            className="btn-secondary"
            style={{ width: '100%', color: '#e11d48', borderColor: '#fecdd3', background: '#fff1f2' }}
          >
            <LogOut size={16} />
            <span>Đăng Xuất Khỏi Tài Khoản</span>
          </button>
        </div>
      </div>
    </div>
  );
};
