'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { MobileContainer } from '@/components/mobile-container';
import { AppHeader } from '@/components/app-header';
import { BottomNav } from '@/components/bottom-nav';
import type { ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
  requireRole?: 'user' | 'admin';
}

export function AppShell({ children, requireRole }: AppShellProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    // Redirect if wrong role
    if (requireRole && user.role !== requireRole) {
      router.replace(user.role === 'admin' ? '/requests' : '/dashboard');
    }
  }, [user, isLoading, router, requireRole]);

  if (isLoading || !user) {
    return (
      <MobileContainer>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-lg">Loading...</div>
        </div>
      </MobileContainer>
    );
  }

  // Don't render if wrong role
  if (requireRole && user.role !== requireRole) {
    return null;
  }

  return (
    <MobileContainer>
      <AppHeader />
      <main className="flex-1 flex flex-col overflow-hidden relative">{children}</main>
      <BottomNav />
    </MobileContainer>
  );
}
