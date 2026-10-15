import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PickleballProvider, usePickleball } from './context/PickleballContext';
import { Player } from './types/pickleball';
import { Navbar } from './components/Navbar';
import { HomeDashboard } from './components/HomeDashboard';
import { MembersRoster } from './components/MembersRoster';
import { ClubStandings } from './components/ClubStandings';
import { DuprCalculator } from './components/DuprCalculator';
import { CourtsideScoreboard } from './components/CourtsideScoreboard';
import { MobileBottomNav } from './components/MobileBottomNav';
import { AuthModal } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import { MatchRecorderModal } from './components/MatchRecorderModal';
import { MatchHistory } from './components/MatchHistory';
import { CreateClubModal, JoinClubModal } from './components/CreateClubModal';
import { PlayerProfileView } from './components/PlayerProfileView';
import { PlayMobile } from './components/PlayMobile';
import { ClubSettingsMobile } from './components/ClubSettingsMobile';
import { TournamentGenerator } from './components/TournamentGenerator';

const MainContent: React.FC = () => {
  const { activeTab, setActiveTab, lang, viewMode, myPlayer } = usePickleball();
  const [isCreateClubOpen, setIsCreateClubOpen] = useState(false);
  const [isJoinClubOpen, setIsJoinClubOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [selectedPlayerForDetail, setSelectedPlayerForDetail] = useState<Player | null>(null);

  // Clear selected player when switching tabs
  useEffect(() => {
    setSelectedPlayerForDetail(null);
  }, [activeTab]);

  const isMobileMode = viewMode === 'mobile';

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      background: isMobileMode ? '#f4faf6' : '#f8fafc'
    }}>

      {/* 2. DESKTOP NAVBAR (Only rendered in Desktop view mode) */}
      {!isMobileMode && (
        <Navbar
          onOpenProfile={() => setIsProfileOpen(true)}
          onCreateClub={() => setIsCreateClubOpen(true)}
          onJoinClub={() => setIsJoinClubOpen(true)}
        />
      )}

      {/* 3. MAIN CONTENT */}
      <main style={{ 
        flex: 1, 
        paddingBottom: isMobileMode ? 90 : 40,
      }}>
        {selectedPlayerForDetail ? (
          <PlayerProfileView
            player={selectedPlayerForDetail}
            onClose={() => setSelectedPlayerForDetail(null)}
            onSelectPlayer={(p) => setSelectedPlayerForDetail(p)}
          />
        ) : (
          <>
            {activeTab === 'home' && (
              <HomeDashboard
                onOpenRecordMatch={() => setIsRecordOpen(true)}
                onOpenSettings={() => setIsProfileOpen(true)}
                onSelectPlayer={(p) => setSelectedPlayerForDetail(p)}
                onOpenPlayMenu={() => {}}
                onCreateClub={() => setIsCreateClubOpen(true)}
                onJoinClub={() => setIsJoinClubOpen(true)}
              />
            )}
            {activeTab === 'members' && (
              <MembersRoster
                onSelectPlayer={(p) => setSelectedPlayerForDetail(p)}
              />
            )}
            {activeTab === 'standings' && (
              <ClubStandings 
                onOpenRecordMatch={() => setIsRecordOpen(true)} 
                onSelectPlayer={(p) => setSelectedPlayerForDetail(p)}
              />
            )}
            {activeTab === 'matches' && (
              <MatchHistory
                onOpenRecordMatch={() => setIsRecordOpen(true)}
                onSelectPlayer={(p) => setSelectedPlayerForDetail(p)}
              />
            )}
            {activeTab === 'tournament' && <TournamentGenerator />}
            {activeTab === 'calculator' && <DuprCalculator />}
            {activeTab === 'scoreboard' && <CourtsideScoreboard />}
            {activeTab === 'play' && <PlayMobile />}
            {activeTab === 'clubSettings' && <ClubSettingsMobile />}
            {/* Always the signed-in account's own record, never another member's */}
            {activeTab === 'profile' && (
              myPlayer ? (
                <PlayerProfileView
                  player={myPlayer}
                  onEditProfile={() => setIsProfileOpen(true)}
                  onSelectPlayer={(p) => setSelectedPlayerForDetail(p)}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                  <div style={{ fontSize: '2.4rem', marginBottom: 12 }}>👤</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>
                    Chưa chọn hồ sơ cá nhân
                  </div>
                  <div style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: 20, maxWidth: 360, margin: '0 auto 20px' }}>
                    Vui lòng chỉnh sửa thông tin hồ sơ hoặc liên kết tài khoản để xem thống kê DUPR của bạn.
                  </div>
                  <button
                    onClick={() => setIsProfileOpen(true)}
                    className="btn-primary"
                    style={{ padding: '10px 24px', borderRadius: 999 }}
                  >
                    Mở Cài Đặt Hồ Sơ
                  </button>
                </div>
              )
            )}
          </>
        )}
      </main>

      {/* 4. MOBILE BOTTOM NAVIGATION (Only rendered in Mobile view mode) */}
      {isMobileMode && <MobileBottomNav />}

      {/* 5. FOOTER (Only rendered in Desktop view mode) */}
      {!isMobileMode && (
        <footer style={{
          marginTop: 'auto',
          borderTop: '1px solid #e2e8f0',
          padding: '32px 20px',
          background: '#ffffff',
          textAlign: 'center',
          fontSize: '0.85rem',
          color: '#64748b',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.2rem' }}>🏓</span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: '#0f172a' }}>
                XGame Pickleball Clubs · DUPR Engine
              </span>
            </div>

            <div>
              {lang === 'vi' 
                ? 'Hệ thống tính điểm DUPR chuẩn quốc tế & Quản lý CLB Pickleball chuyên nghiệp · 2026'
                : 'Official DUPR Rating Algorithm & Pickleball Club Management Platform · 2026'}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <a href="https://mydupr.com" target="_blank" rel="noreferrer" style={{ color: '#059669', textDecoration: 'none', fontWeight: 700 }}>
                mydupr.com
              </a>
            </div>
          </div>
        </footer>
      )}

      {/* Modals */}
      {/* Mounted only while open so the form always starts from the current server data */}
      {isProfileOpen && <UserProfileModal isOpen onClose={() => setIsProfileOpen(false)} />}
      <MatchRecorderModal isOpen={isRecordOpen} onClose={() => setIsRecordOpen(false)} />
      <CreateClubModal
        isOpen={isCreateClubOpen}
        onClose={() => setIsCreateClubOpen(false)}
        onDone={() => {
          setIsCreateClubOpen(false);
          setActiveTab('clubSettings');
        }}
      />
      <JoinClubModal
        isOpen={isJoinClubOpen}
        onClose={() => setIsJoinClubOpen(false)}
        onDone={() => {
          setIsJoinClubOpen(false);
          setActiveTab('home');
        }}
      />
    </div>
  );
};

// Signed-out visitors only ever see the sign-in screen; club data is loaded per account
const AuthGate: React.FC = () => {
  const { currentUser, authReady } = useAuth();

  if (!authReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.4rem' }}>
        🏓
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #063c2c 0%, #0a543e 50%, #074332 100%)' }}>
        <AuthModal isOpen required onClose={() => {}} />
      </div>
    );
  }

  // Keyed by account so nothing loaded for one user survives a switch to another
  return (
    <PickleballProvider key={currentUser.id} user={currentUser}>
      <MainContent />
    </PickleballProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
