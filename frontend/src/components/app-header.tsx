'use client';

import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowLeftRight, LogOut, Shield, User } from 'lucide-react';

export function AppHeader() {
  const { user, switchRole, logout } = useAuth();

  if (!user) return null;

  const isAdmin = user.role === 'admin';

  return (
    <header className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className={isAdmin ? 'bg-primary text-primary-foreground' : 'bg-slate-100'}>
            {isAdmin ? <Shield className="h-4 w-4" /> : user.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{user.name}</span>
            <Badge variant={isAdmin ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
              {isAdmin ? 'Admin' : 'User'}
            </Badge>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">{user.ecosystemId}</span>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <User className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={switchRole} className="cursor-pointer">
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Switch to {isAdmin ? 'User' : 'Admin'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
