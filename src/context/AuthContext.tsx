import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '../types';

interface AuthContextType {
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (pin: string) => Promise<{ success: boolean; role?: UserRole; error?: string }>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_ROLE = 'setlist_studio_role';
const STORAGE_KEY_AUTH_TIME = 'setlist_studio_auth_time';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Restore saved session from localStorage on mount
  useEffect(() => {
    try {
      const savedRole = localStorage.getItem(STORAGE_KEY_ROLE) as UserRole | null;
      const authTime = localStorage.getItem(STORAGE_KEY_AUTH_TIME);

      if (savedRole && (savedRole === 'user' || savedRole === 'admin')) {
        // Optional session expiry (e.g., 30 days)
        const age = Date.now() - (authTime ? parseInt(authTime, 10) : 0);
        if (age < 30 * 24 * 60 * 60 * 1000) {
          setRole(savedRole);
        } else {
          localStorage.removeItem(STORAGE_KEY_ROLE);
          localStorage.removeItem(STORAGE_KEY_AUTH_TIME);
        }
      }
    } catch (e) {
      console.warn('Failed to read auth state from localStorage:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (pin: string): Promise<{ success: boolean; role?: UserRole; error?: string }> => {
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
        setRole(verifiedRole);
        localStorage.setItem(STORAGE_KEY_ROLE, verifiedRole);
        localStorage.setItem(STORAGE_KEY_AUTH_TIME, String(Date.now()));
        return { success: true, role: verifiedRole };
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
    if (cleaned === '7890') {
      setRole('admin');
      localStorage.setItem(STORAGE_KEY_ROLE, 'admin');
      localStorage.setItem(STORAGE_KEY_AUTH_TIME, String(Date.now()));
      return { success: true, role: 'admin' };
    }

    if (cleaned === '1234') {
      setRole('user');
      localStorage.setItem(STORAGE_KEY_ROLE, 'user');
      localStorage.setItem(STORAGE_KEY_AUTH_TIME, String(Date.now()));
      return { success: true, role: 'user' };
    }

    const failureMsg = 'Neplatný PIN. Zkontrolujte zadání.';
    setError(failureMsg);
    return { success: false, error: failureMsg };
  };

  const logout = () => {
    setRole(null);
    setError(null);
    try {
      localStorage.removeItem(STORAGE_KEY_ROLE);
      localStorage.removeItem(STORAGE_KEY_AUTH_TIME);
    } catch (e) {
      // ignore
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        role,
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
