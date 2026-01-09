import Link from 'next/link';
import { CreditCard, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Link href="/cards" className="w-full">
        <Button variant="outline" className="w-full justify-start h-9 px-3 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
          <CreditCard className="h-3.5 w-3.5 mr-2 text-slate-500" />
          <span className="text-xs font-medium">Request Card</span>
        </Button>
      </Link>
      <Link href="/offers" className="w-full">
        <Button variant="outline" className="w-full justify-start h-9 px-3 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
          <Gift className="h-3.5 w-3.5 mr-2 text-slate-500" />
          <span className="text-xs font-medium">View Offers</span>
        </Button>
      </Link>
    </div>
  );
}
