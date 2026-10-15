import React, { useEffect, useRef, useState } from 'react';
import { usePickleball, AppTab } from '../context/PickleballContext';
import { useAuth } from '../context/AuthContext';
import { 
  Home,
  Trophy,
  Calculator, 
  Activity, 
  LogOut, 
  User, 
  ChevronDown, 
  MapPin,
  CheckCircle2,
  History,
  Play,
  Plus,
  Settings,
  Pencil,
  Star,
  Medal
} from 'lucide-react';

interface NavbarProps {
  onOpenProfile: () => void;
  onCreateClub: () => void;
  onJoinClub: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenProfile, onCreateClub, onJoinClub }) => {
  const { activeTab, setActiveTab, lang, setLang, clubs, selectedClub, setSelectedClub, defaultClubId, setDefaultClub, myPlayer } = usePickleball();
  const { currentUser, logout } = useAuth();
  const [showClubDropdown, setShowClubDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const clubDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Close an open dropdown on a click outside it or on Escape
  useEffect(() => {
    if (!showClubDropdown && !showUserDropdown) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!clubDropdownRef.current?.contains(target)) setShowClubDropdown(false);
      if (!userDropdownRef.current?.contains(target)) setShowUserDropdown(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowClubDropdown(false);
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showClubDropdown, showUserDropdown]);

  const navItems: { tab: AppTab; labelVi: string; labelEn: string; icon: React.ReactNode }[] = [
    {
      tab: 'home',
      labelVi: 'Trang Chủ CLB',
      labelEn: 'Club Home',
      icon: <Home size={18} />,
    },
    {
      tab: 'standings',
      labelVi: 'Bảng Xếp Hạng',
      labelEn: 'Standings',
      icon: <Trophy size={18} />,
    },
    {
      tab: 'matches',
      labelVi: 'Lịch Sử Đấu',
      labelEn: 'Matches',
      icon: <History size={18} />,
    },
    {
      tab: 'tournament',
      labelVi: 'Thi Đấu',
      labelEn: 'Tournament',
      icon: <Medal size={18} />,
    },
    {
      tab: 'play',
      labelVi: 'Chơi',
      labelEn: 'Play',
      icon: <Play size={18} />,
    },
    {
      tab: 'calculator',
      labelVi: 'Tính Điểm DUPR',
      labelEn: 'DUPR Calculator',
      icon: <Calculator size={18} />,
    },
    {
      tab: 'scoreboard',
      labelVi: 'Sân Trực Tiếp',
      labelEn: 'Courtside Live',
      icon: <Activity size={18} />,
    },
    {
      tab: 'profile',
      labelVi: 'Cá Nhân',
      labelEn: 'Profile',
      icon: <User size={18} />,
    },
    {
      tab: 'clubSettings',
      labelVi: 'Cài Đặt CLB',
      labelEn: 'Club Settings',
      icon: <Settings size={18} />,
    },
  ];

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid #e2e8f0',
      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
    }}>
      {/* Top Banner with Brand, Club Selector & Profile */}
      <div style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        {/* Logo & Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div 
            onClick={() => setActiveTab('home')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #059669, #064e3b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
              position: 'relative',
            }}>
              <span style={{ fontSize: 20 }}>🏓</span>
              <div style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#84cc16',
                border: '2px solid #ffffff',
              }} />
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: '1.25rem',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span style={{ color: '#0f172a' }}>XGame</span>
                <span style={{ color: '#059669' }}>Pickleball</span>
              </div>
              <div style={{
                fontSize: '0.72rem',
                color: '#64748b',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                DUPR Rating Engine
              </div>
            </div>
          </div>

          {/* Club Dropdown Selector */}
          <div ref={clubDropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowClubDropdown(!showClubDropdown)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 999,
                color: '#0f172a',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <MapPin size={14} color="#059669" />
              <span style={{ fontSize: '1rem' }}>{selectedClub.id.includes('badminton') ? '🏸' : '🏓'}</span>
              <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedClub.name}
              </span>
              <ChevronDown size={14} color="#64748b" />
            </button>

            {showClubDropdown && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                width: 280,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 16,
                padding: 8,
                boxShadow: 'var(--shadow-lg)',
                zIndex: 200,
              }}>
                <div style={{ padding: '6px 10px', fontSize: '0.72rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
                  {lang === 'vi' ? 'Chọn Câu Lạc Bộ' : 'Switch Club'}
                </div>
                {clubs.map((c) => {
                  const isSelected = c.id === selectedClub.id;
                  const isDefault = c.id === defaultClubId;

                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedClub(c);
                        setShowClubDropdown(false);
                      }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 12,
                        cursor: 'pointer',
                        background: isSelected ? '#ecfdf5' : 'transparent',
                        color: isSelected ? '#059669' : '#0f172a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '1.25rem' }}>{c.id.includes('badminton') ? '🏸' : '🏓'}</span>
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{c.name}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>{c.location}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isDefault ? (
                          <span
                            title="Câu lạc bộ mặc định"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              background: '#fef3c7',
                              color: '#b45309',
                              padding: '2px 7px',
                              borderRadius: 999,
                              fontSize: '0.68rem',
                              fontWeight: 800,
                            }}
                          >
                            <Star size={11} fill="#b45309" color="#b45309" />
                            <span>Mặc định</span>
                          </span>
                        ) : (
                          <button
                            title="Đặt làm CLB mặc định"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDefaultClub(c.id);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              padding: 4,
                              borderRadius: 6,
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#f59e0b')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                          >
                            <Star size={14} />
                          </button>
                        )}

                        {isSelected && <CheckCircle2 size={16} color="#059669" />}
                      </div>
                    </div>
                  );
                })}
                <button
                  onClick={() => {
                    setShowClubDropdown(false);
                    onCreateClub();
                  }}
                  style={{
                    width: '100%',
                    marginTop: 6,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1.5px dashed #10b981',
                    background: '#ffffff',
                    color: '#047857',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={16} strokeWidth={3} />
                  <span>{lang === 'vi' ? 'Tạo CLB mới' : 'Create club'}</span>
                </button>
                <button
                  onClick={() => {
                    setShowClubDropdown(false);
                    onJoinClub();
                  }}
                  style={{
                    width: '100%',
                    marginTop: 6,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {lang === 'vi' ? 'Tham gia CLB bằng mã' : 'Join a club with a code'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Actions: Lang toggle & User Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

          {/* Language Toggle */}
          <button
            onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span>{lang === 'vi' ? '🇻🇳 VN' : '🇬🇧 EN'}</span>
          </button>

          {/* User Auth */}
          {currentUser && (
            <div ref={userDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '5px 12px 5px 6px',
                  borderRadius: 999,
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  cursor: 'pointer',
                  color: '#0f172a',
                }}
              >
                <img
                  src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                  alt={currentUser.name}
                  style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                />
                {/* Line height leaves room for Vietnamese diacritics so the two lines never touch */}
                <div style={{ textAlign: 'left', minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    lineHeight: 1.35,
                    maxWidth: 160,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {currentUser.name}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 800, lineHeight: 1.35 }}>
                    DUPR {myPlayer ? myPlayer.doublesRating.toFixed(3) : '—'}
                  </div>
                </div>
                <ChevronDown size={14} color="#64748b" />
              </button>

              {showUserDropdown && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: 240,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 16,
                  padding: 8,
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 200,
                }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>{currentUser.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{currentUser.email}</div>
                  </div>
                  <div
                    onClick={() => {
                      setShowUserDropdown(false);
                      setActiveTab('profile');
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#0f172a',
                      marginTop: 4,
                    }}
                  >
                    <User size={16} color="#059669" />
                    <span>{lang === 'vi' ? 'Hồ sơ & Điểm DUPR' : 'Profile & Ratings'}</span>
                  </div>
                  <div
                    onClick={() => {
                      setShowUserDropdown(false);
                      onOpenProfile();
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#0f172a',
                    }}
                  >
                    <Pencil size={16} color="#059669" />
                    <span>{lang === 'vi' ? 'Sửa hồ sơ & ảnh đại diện' : 'Edit profile & avatar'}</span>
                  </div>
                  <div
                    onClick={() => {
                      setShowUserDropdown(false);
                      logout();
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#e11d48',
                    }}
                  >
                    <LogOut size={16} />
                    <span>{lang === 'vi' ? 'Đăng xuất' : 'Sign out'}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Tab Navigation Bar */}
      <div style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '0 16px 10px',
        display: 'flex',
        justifyContent: 'center',
      }}>
        <div className="nav-tab-bar">
          {navItems.map((item) => {
            const isActive = activeTab === item.tab;
            return (
              <button
                key={item.tab}
                onClick={() => setActiveTab(item.tab)}
                className={`nav-tab-item ${isActive ? 'active' : ''}`}
              >
                {item.icon}
                <span>{lang === 'vi' ? item.labelVi : item.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
