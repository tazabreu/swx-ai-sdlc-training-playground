'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type UserRole } from '@/contexts/auth-context';
import { MobileContainer } from '@/components/mobile-container';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { CreditCard, Shield, User } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { user, actAs } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.replace(user.role === 'admin' ? '/requests' : '/dashboard');
    }
  }, [user, router]);

  const handleLogin = (role: UserRole) => {
    actAs(role);
    router.push(role === 'admin' ? '/requests' : '/dashboard');
  };

  return (
    <MobileContainer>
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full space-y-6">
          {/* Logo/Title */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <CreditCard className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">ACME Financial</h1>
            <p className="text-sm text-muted-foreground">Development Mode - Choose a role</p>
          </div>

          {/* Role Selection */}
          <div className="space-y-3">
            <Card
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleLogin('user')}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-100">
                  <User className="h-6 w-6 text-slate-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">Sign in as User</CardTitle>
                  <CardDescription className="text-xs">
                    user-123 • View cards, transactions, offers
                  </CardDescription>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleLogin('admin')}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">Sign in as Admin</CardTitle>
                  <CardDescription className="text-xs">
                    admin-001 • Manage requests, scores, cleanup
                  </CardDescription>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Info */}
          <p className="text-center text-xs text-muted-foreground px-4">
            This is a development interface. User records are created automatically via the backend API.
          </p>
        </div>
      </div>
    </MobileContainer>
  );
}
