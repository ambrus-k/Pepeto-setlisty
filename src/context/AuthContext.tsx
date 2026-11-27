import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '../types';

interface AuthContextType {
  role: UserRole | null;
  token: string | null;
  isAdminTokenVerified: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (pin: string) => Promise<{ success: boolean; role?: UserRole; token?: string | null; error?: string }>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_ROLE = 'setlist_studio_role';
const STORAGE_KEY_AUTH_TIME = 'setlist_studio_auth_time';
const STORAGE_KEY_TOKEN = 'setlist_studio_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAdminTokenVerified, setIsAdminTokenVerified] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Restore saved session from localStorage on mount
  useEffect(() => {
    try {
      const savedRole = localStorage.getItem(STORAGE_KEY_ROLE) as UserRole | null;
      const authTime = localStorage.getItem(STORAGE_KEY_AUTH_TIME);
      const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);

      if (savedRole && (savedRole === 'user' || savedRole === 'admin')) {
        // Optional session expiry (e.g., 30 days)
        const age = Date.now() - (authTime ? parseInt(authTime, 10) : 0);
        const hasMissingAdminToken = savedRole === 'admin' && !savedToken;
        if (age < 30 * 24 * 60 * 60 * 1000 && !hasMissingAdminToken) {
          setRole(savedRole);
          setToken(savedToken || null);
        } else {
          localStorage.removeItem(STORAGE_KEY_ROLE);
          localStorage.removeItem(STORAGE_KEY_AUTH_TIME);
          localStorage.removeItem(STORAGE_KEY_TOKEN);
        }
      }
    } catch (e) {
      console.warn('Failed to read auth state from localStorage:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Verify stored admin token against backend when mounted or back online
  useEffect(() => {
    if (role !== 'admin' || !token) {
      setIsAdminTokenVerified(false);
      return;
    }

    let cancelled = false;
    const verifyTokenWithServer = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }
      try {
        const res = await fetch('/api/auth/verify', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!res.ok || cancelled) return;
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          setIsAdminTokenVerified(Boolean(data.valid && data.allowOverwrite));
        }
      } catch {
        // Server unreachable (offline) - keep current state until verified
      }
    };

    verifyTokenWithServer();
    window.addEventListener('online', verifyTokenWithServer);
    return () => {
      cancelled = true;
      window.removeEventListener('online', verifyTokenWithServer);
    };
  }, [role, token]);

  const login = async (
    pin: string
  ): Promise<{ success: boolean; role?: UserRole; token?: string | null; error?: string }> => {
    setError(null);
    const cleaned = pin.trim();

    if (!cleaned) {
      const msg = 'Zadejte prosím PIN kód.';
      setError(msg);
      return { success: false, error: msg };
    }

    try {
      // 1. Try server-side verification endpoint
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: cleaned }),
      });

      if (res.ok) {
        const data = await res.json();
        const verifiedRole: UserRole = data.role === 'admin' ? 'admin' : 'user';
        const verifiedToken = typeof data.token === 'string' && data.token ? data.token : null;
        setRole(verifiedRole);
        setToken(verifiedToken);
        setIsAdminTokenVerified(verifiedRole === 'admin' && Boolean(verifiedToken));
        localStorage.setItem(STORAGE_KEY_ROLE, verifiedRole);
        localStorage.setItem(STORAGE_KEY_AUTH_TIME, String(Date.now()));
        if (verifiedToken) {
          localStorage.setItem(STORAGE_KEY_TOKEN, verifiedToken);
        } else {
          localStorage.removeItem(STORAGE_KEY_TOKEN);
        }
        return { success: true, role: verifiedRole, token: verifiedToken };
      }

      // If server returned 401 unauthorized
      if (res.status === 401) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error || 'Neplatný PIN. Zkontrolujte zadání.';
        setError(msg);
        return { success: false, error: msg };
      }
    } catch (netErr) {
      console.warn('Backend API unreachable, checking offline default PINs:', netErr);
    }

    // 2. Offline fallback PIN verification (in case dev/offline mode)
    if (cleaned === '251925') {
      setRole('admin');
      setToken(null);
      setIsAdminTokenVerified(false);
      localStorage.setItem(STORAGE_KEY_ROLE, 'admin');
      localStorage.setItem(STORAGE_KEY_AUTH_TIME, String(Date.now()));
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      return { success: true, role: 'admin', token: null };
    }

    if (cleaned === '2004') {
      setRole('user');
      setToken(null);
      setIsAdminTokenVerified(false);
      localStorage.setItem(STORAGE_KEY_ROLE, 'user');
      localStorage.setItem(STORAGE_KEY_AUTH_TIME, String(Date.now()));
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      return { success: true, role: 'user', token: null };
    }

    const failureMsg = 'Neplatný PIN. Zkontrolujte zadání.';
    setError(failureMsg);
    return { success: false, error: failureMsg };
  };

  const logout = () => {
    setRole(null);
    setToken(null);
    setIsAdminTokenVerified(false);
    setError(null);
    try {
      localStorage.removeItem(STORAGE_KEY_ROLE);
      localStorage.removeItem(STORAGE_KEY_AUTH_TIME);
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    } catch (e) {
      // ignore
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        role,
        token,
        isAdminTokenVerified,
        isAuthenticated: !!role,
        isLoading,
        error,
        login,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
