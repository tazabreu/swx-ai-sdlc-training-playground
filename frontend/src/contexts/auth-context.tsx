'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createMockUser, getAuthTokenForUser, getDefaultEmailForRole } from '@/lib/auth/mock';
import { api } from '@/lib/api/client';

export type UserRole = 'user' | 'admin';

export interface User {
  ecosystemId: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isRegistered: boolean;
  login: (email: string, role: UserRole) => void;
  actAs: (role: UserRole) => void;
  switchRole: () => void;
  logout: () => void;
  registerUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getInitialUser(): User | null {
  return null;
}

function getInitialToken(): string | null {
  return null;
}

function getInitialRegistered(): boolean {
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getInitialUser);
  const [token, setToken] = useState<string | null>(getInitialToken);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistered, setIsRegistered] = useState(getInitialRegistered);
  const registerAttemptTokenRef = useRef<string | null>(null);

  // Initialize from local storage on mount to prevent hydration mismatch
  useEffect(() => {
    const storedUser = localStorage.getItem('acme_user');
    const storedToken = localStorage.getItem('acme_token');
    const storedRegistered = localStorage.getItem('acme_registered') === 'true';

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as User;
        setUser(parsedUser);

        // Migrate older mock tokens (without email in payload) to a more compatible format
        // so /v1/users doesn't fail in backends that rely on payload.email (e.g. AWS/LocalStack fallback).
        if (storedToken && storedToken.startsWith('mock.')) {
          const parts = storedToken.split('.');
          const payloadEncoded = parts[1];
          if (payloadEncoded) {
            try {
              const payload = JSON.parse(atob(payloadEncoded)) as { email?: string };
              if (payload.email === undefined || payload.email.trim().length === 0) {
                const regenerated = getAuthTokenForUser(parsedUser);
                localStorage.setItem('acme_token', regenerated);
                setToken(regenerated);
              }
            } catch {
              // ignore
            }
          }
        }
      } catch (e) {
        // Ignore corrupted localStorage.
      }
    }
    if (storedToken) setToken(storedToken);
    if (storedRegistered) setIsRegistered(storedRegistered);
    
    setIsLoading(false);
  }, []);

  // Auto-register user when logged in but not registered
  // In in-memory mode, users are seeded on backend startup, so this usually succeeds immediately.
  useEffect(() => {
    if (isLoading) return;
    if (!user || !token || isRegistered) return;

    // Avoid repeated attempts in React dev/StrictMode
    if (registerAttemptTokenRef.current === token) return;
    registerAttemptTokenRef.current = token;

    api.users
      .create(token)
      .then(() => {
        setIsRegistered(true);
        localStorage.setItem('acme_registered', 'true');
      })
      .catch(() => {
        // Keep isRegistered=false; pages are gated on registration to avoid cascading errors.
        // In in-memory mode, users are pre-seeded so this should rarely fail.
      });
  }, [isLoading, user, token, isRegistered]);

  const login = (email: string, role: UserRole) => {
    const newUser = createMockUser(email, role);
    const newToken = getAuthTokenForUser(newUser);

    setUser(newUser);
    setToken(newToken);
    setIsRegistered(false);
    localStorage.setItem('acme_user', JSON.stringify(newUser));
    localStorage.setItem('acme_token', newToken);
    localStorage.setItem(`acme_dev_email_${role}`, newUser.email);
    localStorage.removeItem('acme_registered');
  };

  const actAs = (role: UserRole) => {
    const storedRoleEmail =
      typeof window !== 'undefined' ? localStorage.getItem(`acme_dev_email_${role}`) : null;

    const email = storedRoleEmail || getDefaultEmailForRole(role);
    login(email, role);
  };

  const switchRole = () => {
    const nextRole: UserRole = user?.role === 'admin' ? 'user' : 'admin';
    actAs(nextRole);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsRegistered(false);
    localStorage.removeItem('acme_user');
    localStorage.removeItem('acme_token');
    localStorage.removeItem('acme_registered');
  };

  const registerUser = async () => {
    if (!token) return;
    await api.users.create(token);
    setIsRegistered(true);
    localStorage.setItem('acme_registered', 'true');
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, isRegistered, login, actAs, switchRole, logout, registerUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
