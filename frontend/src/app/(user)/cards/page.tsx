'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api, type Card as CardType } from '@/lib/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { CreditCard as CreditCardIcon, Plus, RefreshCw } from 'lucide-react';
import {
  CreditCard,
  CreditCardBack,
  CreditCardChip,
  CreditCardFlipper,
  CreditCardFront,
  CreditCardHint,
  CreditCardMagStripe,
  CreditCardName,
  CreditCardNumber,
  CreditCardServiceProvider,
} from '@/components/ui/credit-card';

// Available card products (hardcoded for demo)
const CARD_PRODUCTS = [
  { id: 'basic', name: 'Basic Card', description: 'Standard credit card' },
  { id: 'premium', name: 'Premium Card', description: 'Higher limits & rewards' },
];

// Format card number for display
function formatCardNumber(cardId: string): string {
  const last4 = cardId.slice(-4);
  return `•••• •••• •••• ${last4}`;
}

export default function CardsPage() {
  const { token, isRegistered } = useAuth();
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(CARD_PRODUCTS[0].id);

  const fetchCards = async () => {
    if (!token || !isRegistered) return;
    setLoading(true);
    try {
      const res = await api.cards.list(token);
      setCards(res.cards || []);
    } catch (err) {
      toast.error('Failed to load cards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, [token, isRegistered]);

  const handleRequestCard = async () => {
    if (!token || !selectedProduct) return;

    setRequesting(true);
    try {
      await api.cards.request(selectedProduct, token);
      toast.success('Card request submitted successfully!');
      setDialogOpen(false);
      fetchCards();
    } catch (err) {
      toast.error('Failed to request card');
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-8" />
        </div>
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">My Cards</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={fetchCards}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[340px] rounded-2xl">
              <DialogHeader>
                <DialogTitle>Request New Card</DialogTitle>
                <DialogDescription>Choose a card type to request.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-4">
                {CARD_PRODUCTS.map((product) => (
                  <Card
                    key={product.id}
                    className={`cursor-pointer transition-colors ${
                      selectedProduct === product.id ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => setSelectedProduct(product.id)}
                  >
                    <CardContent className="p-3">
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleRequestCard} disabled={requesting}>
                  {requesting ? 'Submitting...' : 'Submit'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {cards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCardIcon className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">No cards yet</p>
            <p className="text-sm text-muted-foreground text-center">Request your first card to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {cards.map((card) => (
            <div key={card.cardId} className="space-y-3">
              {/* Credit Card Visual */}
              <div className="flex justify-center">
                <CreditCard>
                  <CreditCardFlipper>
                    <CreditCardFront className="bg-slate-800">
                      {/* Card Type Label */}
                      <span className="absolute top-0 left-0 text-[10px] uppercase tracking-widest text-white/60 font-medium">
                        {card.type}
                      </span>
                      {/* Logo */}
                      <div className="absolute top-0 right-0">
                        <span className="text-xs font-bold text-white/80 tracking-tight">ACME</span>
                      </div>
                      <CreditCardChip />
                      <CreditCardServiceProvider type="Visa" className="brightness-0 invert opacity-80" />
                      <CreditCardName className="absolute bottom-0 left-0 text-sm text-white/90">
                        Card Holder
                      </CreditCardName>
                    </CreditCardFront>
                    <CreditCardBack className="bg-slate-800">
                      <CreditCardMagStripe />
                      <CreditCardNumber className="absolute bottom-0 left-0 text-base text-white/90">
                        {formatCardNumber(card.cardId)}
                      </CreditCardNumber>
                      <div className="-translate-y-1/2 absolute top-1/2 right-0 text-right">
                        <p className="text-[10px] text-white/50 uppercase mb-0.5">Status</p>
                        <p className={`text-xs font-medium ${
                          card.status === 'active' ? 'text-white' : 'text-white/60'
                        }`}>
                          {card.status}
                        </p>
                      </div>
                    </CreditCardBack>
                  </CreditCardFlipper>
                </CreditCard>
              </div>

              {/* Card Details */}
              <Card className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                <CardContent className="p-3">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Limit</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">${card.limit.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Balance</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">${card.balance.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Available</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">${card.availableCredit.toLocaleString()}</p>
                    </div>
                  </div>
                  {card.minimumPayment > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] text-muted-foreground text-center">
                        Min payment: <span className="font-medium text-slate-700 dark:text-slate-300">${card.minimumPayment.toLocaleString()}</span>
                        {card.nextDueDate && (
                          <span className="ml-1">by {new Date(card.nextDueDate).toLocaleDateString()}</span>
                        )}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
