'use client';

import { AppShell } from '@/components/app-shell';
import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AppShell requireRole="admin">{children}</AppShell>;
}
