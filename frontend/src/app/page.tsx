'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RoleToggleButton } from '@/components/role-toggle-button';

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (user?.role === 'admin') {
      router.replace('/requests');
    } else if (user?.role === 'user') {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="animate-pulse text-lg">Redirecting…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">ACME Financial</CardTitle>
          <CardDescription>Dev mode — switch between User and Admin</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <RoleToggleButton className="w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
