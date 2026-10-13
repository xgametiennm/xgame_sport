import React, { useState } from 'react';
import { LogOut } from 'lucide-react';
import { NewClubInput } from '../services/api';
import { UserAccount } from '../types/pickleball';
import { CreateClubForm, JoinClubForm } from './ClubForms';
import { OwnerNotice } from './CreateClubModal';
import { MobileCard, PillToggle } from './MobileUi';

interface ClubOnboardingProps {
  user: UserAccount;
  onCreate: (input: NewClubInput) => Promise<unknown>;
  onJoin: (code: string) => Promise<unknown>;
  onLogout: () => void;
}

/** Shown to a signed-in account that does not belong to any club yet. */
export const ClubOnboarding: React.FC<ClubOnboardingProps> = ({ user, onCreate, onJoin, onLogout }) => {
  const [mode, setMode] = useState<'join' | 'create'>('join');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #d9f5e5 0%, #f4faf6 240px, #f4faf6 100%)',
      padding: '32px 16px',
    }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: '2.6rem' }}>🏓</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#064030' }}>Chào {user.name}!</h1>
          <p style={{ fontSize: '0.88rem', color: '#475569', marginTop: 4 }}>
            Bạn chưa thuộc câu lạc bộ nào. Hãy tham gia một CLB bằng mã, hoặc tạo CLB của riêng bạn.
          </p>
        </div>

        <MobileCard style={{ padding: 18 }}>
          <div style={{ marginBottom: 16 }}>
            <PillToggle
              stretch
              value={mode}
              onChange={setMode}
              options={[
                { value: 'join', label: 'Tham gia bằng mã' },
                { value: 'create', label: 'Tạo CLB mới' },
              ]}
            />
          </div>

          {mode === 'join' ? (
            <JoinClubForm onSubmit={onJoin} />
          ) : (
            <>
              <OwnerNotice name={user.name} />
              <CreateClubForm onSubmit={onCreate} />
            </>
          )}
        </MobileCard>

        <button
          onClick={onLogout}
          style={{
            margin: '18px auto 0',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <LogOut size={15} />
          <span>Đăng xuất ({user.email})</span>
        </button>
      </div>
    </div>
  );
};
