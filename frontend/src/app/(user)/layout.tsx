'use client';

import { AppShell } from '@/components/app-shell';
import type { ReactNode } from 'react';

export default function UserLayout({ children }: { children: ReactNode }) {
  return <AppShell requireRole="user">{children}</AppShell>;
}
