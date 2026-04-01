'use client';

import { createContext, useContext, useState, useEffect } from 'react';

type UserRole = 'admin' | 'viewer' | null;

interface AuthContextType {
  role: UserRole;
  isAuthenticated: boolean;
  login: (password: string) => boolean;
  logout: () => void;
  canEdit: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>(null);

  useEffect(() => {
    // Check if user is already logged in
    const savedRole = localStorage.getItem('userRole') as UserRole;
    if (savedRole) {
      setRole(savedRole);
    }
  }, []);

  const login = (password: string): boolean => {
    // Check against environment variables
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin123';
    const viewerPassword =
      process.env.NEXT_PUBLIC_VIEWER_PASSWORD || 'viewer123';

    if (password === adminPassword) {
      setRole('admin');
      localStorage.setItem('userRole', 'admin');
      return true;
    } else if (password === viewerPassword) {
      setRole('viewer');
      localStorage.setItem('userRole', 'viewer');
      return true;
    }

    return false;
  };

  const logout = () => {
    setRole(null);
    localStorage.removeItem('userRole');
  };

  const value: AuthContextType = {
    role,
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
