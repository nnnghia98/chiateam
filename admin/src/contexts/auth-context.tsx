'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { UserRole } from '@/lib/auth';

interface AuthContextType {
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (_password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  canEdit: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });

        if (!response.ok) {
          setRole(null);
          return;
        }

        const session = await response.json();
        setRole(session.authenticated ? session.role : null);
      } catch (error) {
        console.error('Failed to load admin session:', error);
        setRole(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  const login = async (password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setRole(null);
        return false;
      }

      const session = await response.json();
      setRole(session.role);
      return true;
    } catch (error) {
      console.error('Failed to log in:', error);
      setRole(null);
      return false;
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Failed to log out cleanly:', error);
    }
    setRole(null);
  };

  const value: AuthContextType = {
    role,
    isLoading,
    isAuthenticated: role !== null,
    login,
    logout,
    canEdit: role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
