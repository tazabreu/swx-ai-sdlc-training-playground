'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api, type Card as CardType } from '@/lib/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { CreditCard as CreditCardIcon, Plus, RefreshCw, Trash2, Filter, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [cancelling, setCancelling] = useState<string | null>(null); // cardId being cancelled
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cardToCancel, setCardToCancel] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState(CARD_PRODUCTS[0].id);
  const [hideCancelled, setHideCancelled] = useState(false);
  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(new Set());

  const toggleCardCollapse = (cardId: string) => {
    setCollapsedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const filteredCards = hideCancelled 
    ? cards.filter((card) => card.status !== 'cancelled')
    : cards;

  const cancelledCount = cards.filter((card) => card.status === 'cancelled').length;

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

  const openCancelDialog = (cardId: string) => {
    setCardToCancel(cardId);
    setCancelDialogOpen(true);
  };

  const handleCancelCard = async () => {
    if (!token || !cardToCancel) return;

    setCancelling(cardToCancel);
    try {
      await api.cards.cancel(cardToCancel, token);
      toast.success('Card cancelled successfully');
      setCancelDialogOpen(false);
      setCardToCancel(null);
      fetchCards();
    } catch (err) {
      toast.error('Failed to cancel card');
    } finally {
      setCancelling(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">My Cards</h1>
        <div className="flex items-center gap-1">
          {cancelledCount > 0 && (
            <Button 
              variant={hideCancelled ? "secondary" : "ghost"} 
              size="icon"
              onClick={() => setHideCancelled(!hideCancelled)}
              title={hideCancelled ? "Show cancelled cards" : "Hide cancelled cards"}
            >
              <Filter className="h-4 w-4" />
            </Button>
          )}
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

      {filteredCards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCardIcon className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">{hideCancelled && cancelledCount > 0 ? 'No active cards' : 'No cards yet'}</p>
            <p className="text-sm text-muted-foreground text-center">
              {hideCancelled && cancelledCount > 0 
                ? `${cancelledCount} cancelled card${cancelledCount > 1 ? 's' : ''} hidden`
                : 'Request your first card to get started'}
            </p>
            {hideCancelled && cancelledCount > 0 && (
              <Button 
                variant="link" 
                size="sm" 
                className="mt-2"
                onClick={() => setHideCancelled(false)}
              >
                Show cancelled cards
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Filter info banner */}
          {hideCancelled && cancelledCount > 0 && (
            <div className="text-xs text-muted-foreground text-center py-1">
              {cancelledCount} cancelled card{cancelledCount > 1 ? 's' : ''} hidden
            </div>
          )}
          {filteredCards.map((card) => {
            const isCollapsed = collapsedCards.has(card.cardId);
            return (
            <div key={card.cardId} className="space-y-2">
              {/* Compact Header - always visible */}
              <div 
                className="flex items-center justify-between px-2 py-1 cursor-pointer"
                onClick={() => toggleCardCollapse(card.cardId)}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-5 rounded ${card.status === 'cancelled' ? 'bg-slate-400' : 'bg-slate-800'}`} />
                  <span className="text-sm font-medium">{card.type}</span>
                  <span className="text-xs text-muted-foreground">
                    ••{card.cardId.slice(-4)}
                  </span>
                  {card.status !== 'active' && (
                    <Badge 
                      variant={card.status === 'cancelled' ? 'destructive' : 'secondary'}
                      className="uppercase text-[8px] font-semibold px-1 py-0"
                    >
                      {card.status}
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
              </div>

              {/* Expandable Content */}
              {!isCollapsed && (
                <>
              {/* Credit Card Visual */}
              <div className="flex justify-center">
                <CreditCard className={card.status === 'cancelled' ? 'opacity-50' : ''}>
                  <CreditCardFlipper>
                    <CreditCardFront className="bg-slate-800">
                      {/* Card Type Label */}
                      <span className="absolute top-0 left-0 text-[10px] uppercase tracking-widest text-white/60 font-medium">
                        {card.type}
                      </span>
                      {/* Logo */}
                      <div className="absolute top-0 right-0">
                        <span className="text-xs font-bold text-white/80 tracking-tight">TAZCO</span>
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
                  {/* Cancel button - only show for active cards */}
                  {card.status === 'active' && (
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={() => openCancelDialog(card.cardId)}
                        disabled={cancelling === card.cardId}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Cancel Card
                      </Button>
                    </div>
                  )}
                  {/* Show cancellation info for cancelled cards */}
                  {card.status === 'cancelled' && card.cancelledAt && (
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] text-muted-foreground text-center">
                        Cancelled on {new Date(card.cancelledAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
              </>
              )}
            </div>
          );
          })}
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Cancel Card</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this card? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setCancelDialogOpen(false);
                setCardToCancel(null);
              }}
              disabled={!!cancelling}
            >
              Keep Card
            </Button>
            <Button 
              variant="destructive"
              size="sm" 
              onClick={handleCancelCard}
              disabled={!!cancelling}
            >
              {cancelling ? 'Cancelling...' : 'Yes, Cancel Card'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
