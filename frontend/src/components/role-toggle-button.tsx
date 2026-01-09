'use client';

import { useRouter } from 'next/navigation';
import { useAuth, type UserRole } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Shield, User } from 'lucide-react';

function getDestination(role: UserRole): string {
  return role === 'admin' ? '/requests' : '/dashboard';
}

export function RoleToggleButton({ className }: { className?: string }) {
  const router = useRouter();
  const { user, actAs } = useAuth();

  const nextRole: UserRole = user ? (user.role === 'admin' ? 'user' : 'admin') : 'user';
  const label = user ? `Act as ${nextRole === 'admin' ? 'Admin' : 'User'}` : 'Act as User';

  const Icon = nextRole === 'admin' ? Shield : User;

  const handleClick = () => {
    actAs(nextRole);
    router.push(getDestination(nextRole));
  };

  return (
    <Button variant="outline" size="sm" className={className} onClick={handleClick}>
      <Icon className="h-4 w-4 mr-2" />
      {label}
    </Button>
  );
}

