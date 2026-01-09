'use client';

import { useAuth } from '@/contexts/auth-context';
import { useDashboard } from '@/hooks/use-dashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';
import { StatsGrid } from '@/components/dashboard/stats-grid';
import { CardsList } from '@/components/dashboard/cards-list';
import { QuickActions } from '@/components/dashboard/quick-actions';

export default function DashboardPage() {
  const { user, token, isRegistered, isLoading } = useAuth();
  const { dashboard, loading, error, refresh } = useDashboard(token, { enabled: isRegistered });

  if (isLoading || (token && !isRegistered) || loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const cards = dashboard?.cards || [];
  const dashboardUser = dashboard?.user;

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-950/50">
      {/* Fixed Top Section */}
      <div className="p-4 pb-2 space-y-4 shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
              Hi, {user?.name?.split(' ')[0]}
            </h1>
            <p className="text-xs text-muted-foreground">Welcome back</p>
          </div>
          <Button variant="ghost" size="icon" onClick={refresh} className="h-8 w-8 rounded-full">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>

        {error && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        <StatsGrid user={dashboardUser} cards={cards} />
        <QuickActions />
      </div>

      {/* Scrollable Bottom Section */}
      <div className="flex-1 overflow-y-auto p-4 pt-2 min-h-0">
        <CardsList cards={cards} />
      </div>
    </div>
  );
}
