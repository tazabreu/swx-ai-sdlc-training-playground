'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import { CreditCard, Gift, Home, Receipt, ClipboardList, Settings } from 'lucide-react';

const userNavItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/cards', label: 'Cards', icon: CreditCard },
  { href: '/transactions', label: 'Activity', icon: Receipt },
  { href: '/offers', label: 'Offers', icon: Gift },
];

const adminNavItems = [
  { href: '/requests', label: 'Requests', icon: ClipboardList },
  { href: '/scores', label: 'Admin', icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;

  const navItems = user.role === 'admin' ? adminNavItems : userNavItems;

  return (
    <nav className="bg-white border-t py-2 px-4 shrink-0">
      <div className="flex justify-around items-center">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'fill-primary/10')} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
