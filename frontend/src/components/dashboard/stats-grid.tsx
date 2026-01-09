import { Card, CardContent } from '@/components/ui/card';
import { TierBadge } from '@/components/tier-badge';
import { TrendingUp, Wallet } from 'lucide-react';
import type { DashboardUser, Card as CardType } from '@/types';

interface StatsGridProps {
  user?: DashboardUser;
  cards: CardType[];
}

export function StatsGrid({ user, cards }: StatsGridProps) {
  const totalAvailableCredit = cards.reduce((sum, c) => sum + (c.availableCredit || 0), 0);
  const cardCount = cards.length;

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Credit Score */}
      <Card className="border shadow-sm bg-white dark:bg-slate-950">
        <CardContent className="p-3 flex flex-col justify-between h-full">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              <TrendingUp className="h-3 w-3" />
            </div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Score</span>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {user?.score ?? '—'}
            </div>
            {user?.tier && (
              <div className="mt-1">
                <TierBadge tier={user.tier} className="text-[9px] py-0 h-4 px-1.5 font-medium" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Total Credit */}
      <Card className="border shadow-sm bg-white dark:bg-slate-950">
        <CardContent className="p-3 flex flex-col justify-between h-full">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              <Wallet className="h-3 w-3" />
            </div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Credit</span>
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 truncate">
              ${totalAvailableCredit.toLocaleString()}
            </div>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              Available across {cardCount} card{cardCount !== 1 ? 's' : ''}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
