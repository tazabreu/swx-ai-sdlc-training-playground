import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TierBadgeProps {
  tier?: string;
  className?: string;
}

export function TierBadge({ tier, className }: TierBadgeProps) {
  if (!tier) return null;

  const getTierColor = (tierName: string) => {
    switch (tierName.toLowerCase()) {
      case 'platinum':
        return 'bg-gradient-to-r from-slate-400 to-slate-600';
      case 'gold':
        return 'bg-gradient-to-r from-yellow-400 to-yellow-600';
      case 'silver':
        return 'bg-gradient-to-r from-gray-300 to-gray-500';
      default:
        return 'bg-gradient-to-r from-amber-600 to-amber-800';
    }
  };

  return (
    <Badge
      className={cn(
        'text-white border-0',
        getTierColor(tier),
        className
      )}
    >
      {tier}
    </Badge>
  );
}
