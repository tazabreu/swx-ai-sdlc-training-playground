'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { api, type Offer } from '@/lib/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Gift, CreditCard, RefreshCw, Check, Clock, AlertTriangle } from 'lucide-react';

export default function OffersPage() {
  const router = useRouter();
  const { token, isRegistered } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);

  const fetchOffers = async () => {
    if (!token || !isRegistered) return;
    setLoading(true);

    try {
      const res = await api.offers.list(token);
      setOffers(res.offers || []);
    } catch {
      // Avoid noisy console errors in dev; UI handles empty/error states.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, [token, isRegistered]);

  const handleApply = async (productId: string) => {
    if (!token) return;
    setRequesting(productId);
    try {
      const res = await api.cards.request(productId, token);
      if (res.request.status === 'approved') {
        toast.success('Card approved! Check your cards.');
        router.push('/cards');
      } else {
        toast.info('Request submitted! Pending admin review.');
        router.push('/cards');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply');
    } finally {
      setRequesting(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-8 w-8" />
        </div>
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Offers</h1>
          <p className="text-xs text-muted-foreground">Available products for you</p>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchOffers}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {offers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Gift className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">No offers available</p>
            <p className="text-sm text-muted-foreground text-center">Check back later for exclusive offers</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => {
            const isEligible = offer.eligibility.eligible;
            const needsApproval = offer.eligibility.subjectToApproval;
            const cooldown = offer.eligibility.cooldownUntil;
            const isOnCooldown = cooldown !== null && new Date(cooldown) > new Date();

            return (
              <Card key={offer.productId} className={`overflow-hidden ${!isEligible ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm">{offer.name}</h3>
                        {needsApproval ? (
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            <Clock className="h-3 w-3 mr-0.5" />
                            Review
                          </Badge>
                        ) : isEligible ? (
                          <Badge variant="default" className="text-[10px] shrink-0 bg-green-600">
                            <Check className="h-3 w-3 mr-0.5" />
                            Pre-approved
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] shrink-0">
                            <AlertTriangle className="h-3 w-3 mr-0.5" />
                            Not eligible
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{offer.description}</p>

                      {/* Terms */}
                      <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
                        <span>Limit: ${offer.terms.creditLimit.toLocaleString()}</span>
                        <span>APR: {offer.terms.apr}%</span>
                        {offer.terms.annualFee > 0 && <span>Fee: ${offer.terms.annualFee}/yr</span>}
                      </div>

                      {isOnCooldown && cooldown && (
                        <p className="text-[10px] text-amber-600 mt-2">
                          Available after {new Date(cooldown).toLocaleDateString()}
                        </p>
                      )}

                      <Button
                        variant={isEligible ? 'default' : 'outline'}
                        size="sm"
                        className="mt-3 h-7 text-xs"
                        disabled={!isEligible || isOnCooldown || requesting === offer.productId}
                        onClick={() => handleApply(offer.productId)}
                      >
                        {requesting === offer.productId
                          ? 'Applying...'
                          : needsApproval
                            ? 'Apply (Review Required)'
                            : 'Apply Now'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
