import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserAccount } from '../types/pickleball';
import { api, GoogleLoginPayload } from '../services/api';

interface AuthResult {
  success: boolean;
  message: string;
}

interface AuthContextType {
  currentUser: UserAccount | null;
  // False until the server has answered whether there is a signed-in session
  authReady: boolean;
  isAuthenticated: boolean;
  loginWithPassword: (email: string, password: string) => Promise<AuthResult>;
  loginWithGoogle: (googleProfile: GoogleLoginPayload) => Promise<AuthResult>;
  registerAccount: (email: string, name: string, password: string) => Promise<AuthResult>;
  logout: () => void;
  setCurrentUser: (user: UserAccount) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const failure = (err: unknown, fallback: string): AuthResult => ({
  success: false,
  message: err instanceof Error ? err.message : fallback,
});

// Accounts and sessions live on the server: the session is an httpOnly cookie,
// so the signed-in user is asked from the API on load instead of read from storage.
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getMe().then((user) => {
      if (cancelled) return;
      setCurrentUser(user);
      setAuthReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loginWithPassword = async (email: string, password: string): Promise<AuthResult> => {
    if (!email || !email.includes('@')) {
      return { success: false, message: 'Vui lòng nhập địa chỉ email hợp lệ.' };
    }
    if (!password) {
      return { success: false, message: 'Vui lòng nhập mật khẩu.' };
    }

    try {
      setCurrentUser(await api.login(email.trim().toLowerCase(), password));
      return { success: true, message: 'Đăng nhập thành công!' };
    } catch (err) {
      return failure(err, 'Đăng nhập không thành công');
    }
  };

  const registerAccount = async (email: string, name: string, password: string): Promise<AuthResult> => {
    if (!email || !email.includes('@')) {
      return { success: false, message: 'Vui lòng nhập địa chỉ email hợp lệ.' };
    }
    if (!name || name.trim().length < 2) {
      return { success: false, message: 'Vui lòng nhập họ và tên (tối thiểu 2 ký tự).' };
    }

    try {
      setCurrentUser(await api.register(email.trim().toLowerCase(), name.trim(), password));
      return { success: true, message: 'Đăng ký tài khoản thành công!' };
    } catch (err) {
      return failure(err, 'Đăng ký không thành công');
    }
  };

  const loginWithGoogle = async (googleProfile: GoogleLoginPayload): Promise<AuthResult> => {
    try {
      const user = await api.loginWithGoogle(googleProfile);
      setCurrentUser(user);
      return { success: true, message: `Chào mừng ${user.name}, đăng nhập Google thành công!` };
    } catch (err) {
      return failure(err, 'Đăng nhập Google thất bại');
    }
  };

  const logout = () => {
    api.logout().catch((err) => console.warn('Logout request failed:', err));
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        authReady,
        isAuthenticated: !!currentUser,
        loginWithPassword,
        loginWithGoogle,
        registerAccount,
        logout,
        setCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
