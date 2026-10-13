import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Shown as the app's sign-in screen: it cannot be dismissed
  required?: boolean;
}

const GoogleIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, required }) => {
  const { loginWithPassword, loginWithGoogle, registerAccount } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);


  // Listen for message from external Google popup window
  useEffect(() => {
    const handlePopupMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS' && event.data?.profile) {
        setLoading(true);
        setStatusMsg(null);
        try {
          const res = await loginWithGoogle(event.data.profile);
          if (res.success) {
            setStatusMsg({ type: 'success', text: res.message });
            setTimeout(() => {
              onClose();
            }, 600);
          } else {
            setStatusMsg({ type: 'error', text: res.message });
          }
        } catch {
          setStatusMsg({ type: 'error', text: 'Đăng nhập Google thất bại, vui lòng thử lại' });
        } finally {
          setLoading(false);
        }
      }
    };

    window.addEventListener('message', handlePopupMessage);
    return () => window.removeEventListener('message', handlePopupMessage);
  }, [loginWithGoogle, onClose]);

  // Support Google Identity Services with real Client ID (One-Tap & Token initialization)
  useEffect(() => {
    if (!isOpen) return;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const setupGSI = () => {
      const google = (window as any).google;
      if (google?.accounts?.id) {
        try {
          google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: any) => {
              if (response.credential) {
                setLoading(true);
                setStatusMsg(null);
                try {
                  const res = await loginWithGoogle({ credential: response.credential } as any);
                  if (res.success) {
                    setStatusMsg({ type: 'success', text: res.message });
                    setTimeout(() => onClose(), 600);
                  } else {
                    setStatusMsg({ type: 'error', text: res.message });
                  }
                } catch {
                  setStatusMsg({ type: 'error', text: 'Đăng nhập Google thất bại' });
                } finally {
                  setLoading(false);
                }
              }
            }
          });
        } catch (e) {
          console.warn('GSI setup notice:', e);
        }
      }
    };

    setupGSI();
  }, [isOpen, loginWithGoogle, onClose]);

  if (!isOpen) return null;

  // Trigger Google Popup (real external window or Google GIS popup)
  const handleOpenGooglePopup = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    // 1. If Google GIS Client ID is provided in .env, use official Google tokenClient popup
    if (clientId && (window as any).google?.accounts?.oauth2) {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
          callback: async (tokenResponse: any) => {
            if (tokenResponse && tokenResponse.access_token) {
              setLoading(true);
              try {
                const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                });
                const googleUser = await infoRes.json();
                const res = await loginWithGoogle({
                  email: googleUser.email,
                  name: googleUser.name,
                  avatar: googleUser.picture,
                  googleId: googleUser.sub,
                });
                if (res.success) {
                  setStatusMsg({ type: 'success', text: res.message });
                  setTimeout(() => onClose(), 600);
                }
              } catch (err: any) {
                setStatusMsg({ type: 'error', text: err.message || 'Lỗi xác thực Google' });
              } finally {
                setLoading(false);
              }
            }
          }
        });
        client.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (e) {
        console.warn('Google GIS tokenClient notice:', e);
      }
    }

    // 2. Open standard Google OAuth popup window centered on screen
    const width = 480;
    const height = 640;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      '/google-oauth.html',
      'GoogleAccountSignIn',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,menubar=no,toolbar=no`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      setStatusMsg({
        type: 'error',
        text: 'Trình duyệt đang chặn cửa sổ Popup. Vui lòng nhấn vào biểu tượng chặn popup trên thanh địa chỉ để mở cửa sổ đăng nhập Google.'
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(null);

    try {
      if (mode === 'login') {
        const res = await loginWithPassword(email, password);
        if (res.success) {
          setStatusMsg({ type: 'success', text: 'Đăng nhập thành công!' });
          setTimeout(() => {
            onClose();
          }, 500);
        } else {
          setStatusMsg({ type: 'error', text: res.message });
        }
      } else {
        const res = await registerAccount(email, name, password);
        if (res.success) {
          setStatusMsg({ type: 'success', text: 'Tạo tài khoản thành công!' });
          setTimeout(() => {
            onClose();
          }, 500);
        } else {
          setStatusMsg({ type: 'error', text: res.message });
        }
      }
    } catch {
      setStatusMsg({ type: 'error', text: 'Đã xảy ra lỗi, vui lòng thử lại.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          maxWidth: 440, 
          padding: '28px 24px', 
          borderRadius: 20,
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: '#ecfdf5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#059669',
              border: '1px solid #a7f3d0',
            }}>
              <Mail size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                {mode === 'login' ? 'Đăng Nhập Tài Khoản' : 'Đăng Ký Tài Khoản'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0 0' }}>
                Quản lý điểm DUPR, trận đấu & CLB chính thức
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: required ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Google Sign In Button - Triggers Real Popup Window */}
        <button
          type="button"
          onClick={handleOpenGooglePopup}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 12,
            border: '1.5px solid #dadce0',
            background: '#ffffff',
            color: '#1e293b',
            fontSize: '0.94rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            transition: 'all 0.15s ease',
            marginBottom: 16,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f8fafc';
            e.currentTarget.style.borderColor = '#4285F4';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#ffffff';
            e.currentTarget.style.borderColor = '#dadce0';
          }}
        >
          <GoogleIcon />
          <span>Đăng nhập bằng tài khoản Google</span>
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18, gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Hoặc dùng Email & Mật khẩu</span>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        </div>

        {/* Mode Toggle Tabs */}
        <div style={{
          display: 'flex',
          background: '#f1f5f9',
          padding: 4,
          borderRadius: 12,
          marginBottom: 18,
          border: '1px solid #e2e8f0',
        }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setStatusMsg(null); }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              fontSize: '0.88rem',
              fontWeight: 800,
              cursor: 'pointer',
              background: mode === 'login' ? '#0d5e46' : 'transparent',
              color: mode === 'login' ? '#ffffff' : '#64748b',
              transition: 'all 0.15s ease',
            }}
          >
            Đăng Nhập
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setStatusMsg(null); }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              fontSize: '0.88rem',
              fontWeight: 800,
              cursor: 'pointer',
              background: mode === 'register' ? '#0d5e46' : 'transparent',
              color: mode === 'register' ? '#ffffff' : '#64748b',
              transition: 'all 0.15s ease',
            }}
          >
            Đăng Ký Mới
          </button>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 10,
            marginBottom: 16,
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: statusMsg.type === 'success' ? '#ecfdf5' : '#fef2f2',
            color: statusMsg.type === 'success' ? '#059669' : '#dc2626',
            border: `1px solid ${statusMsg.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          }}>
            {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Login / Register Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'register' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Họ và Tên:
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-light"
                  style={{ paddingLeft: 36 }}
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Địa chỉ Email:
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
              <input
                type="email"
                required
                placeholder="vidu@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-light"
                style={{ paddingLeft: 36 }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Mật khẩu:
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
              <input
                type="password"
                required
                minLength={mode === 'register' ? 6 : undefined}
                placeholder={mode === 'register' ? 'Tối thiểu 6 ký tự' : 'Nhập mật khẩu...'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-light"
                style={{ paddingLeft: 36 }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', marginTop: 8, padding: '12px', fontSize: '0.95rem', borderRadius: 12 }}
          >
            <span>{loading ? 'Đang xử lý...' : mode === 'login' ? 'Đăng Nhập' : 'Tạo Tài Khoản'}</span>
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};
