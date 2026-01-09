'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api, type Card as CardType, type Transaction } from '@/lib/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Receipt, ArrowDownLeft, ArrowUpRight, RefreshCw, ShoppingCart, Banknote } from 'lucide-react';

// Quick merchants for simulation
const MERCHANTS = ['Amazon', 'Starbucks', 'Uber', 'Netflix', 'Grocery Store', 'Gas Station', 'Restaurant'];

export default function TransactionsPage() {
  const { token, isRegistered } = useAuth();
  const [cards, setCards] = useState<CardType[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulation dialogs
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('Amazon');
  const [processing, setProcessing] = useState(false);

  const fetchData = async () => {
    if (!token || !isRegistered) return;
    setLoading(true);

    try {
      const cardsRes = await api.cards.list(token);
      const fetchedCards = cardsRes.cards || [];
      setCards(fetchedCards);

      // Auto-select first card if none selected
      if (fetchedCards.length > 0 && !selectedCardId) {
        setSelectedCardId(fetchedCards[0].cardId);
      }

      // Fetch transactions for all cards
      const allTransactions: Transaction[] = [];
      for (const card of fetchedCards) {
        try {
          const txRes = await api.cards.getTransactions(card.cardId, token);
          allTransactions.push(...(txRes.transactions || []));
        } catch {
          // Card might not have transactions
        }
      }

      // Sort by timestamp descending
      allTransactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setTransactions(allTransactions);
    } catch {
      // Avoid noisy console errors in dev; UI handles empty/error states.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, isRegistered]);

  const handlePurchase = async () => {
    if (!token || !selectedCardId || !amount) return;

    setProcessing(true);
    try {
      await api.cards.purchase(
        selectedCardId,
        { amount: parseFloat(amount), merchant, category: 'shopping' },
        token
      );
      toast.success(`Purchase of $${amount} at ${merchant} completed!`);
      setPurchaseDialogOpen(false);
      setAmount('');
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setProcessing(false);
    }
  };

  const handlePayment = async () => {
    if (!token || !selectedCardId || !amount) return;

    setProcessing(true);
    try {
      const res = await api.cards.payment(selectedCardId, { amount: parseFloat(amount) }, token);
      const scoreImpact = (res as { scoreImpact?: { delta: number } }).scoreImpact;
      const impactText = scoreImpact ? ` (Score ${scoreImpact.delta >= 0 ? '+' : ''}${scoreImpact.delta})` : '';
      toast.success(`Payment of $${amount} completed!${impactText}`);
      setPaymentDialogOpen(false);
      setAmount('');
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  const selectedCard = cards.find((c) => c.cardId === selectedCardId);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-8 w-8" />
        </div>
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-950/50">
      {/* Fixed Top Section */}
      <div className="p-4 pb-2 space-y-4 shrink-0 bg-white/50 dark:bg-slate-950/50 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
              Activity
            </h1>
            <p className="text-xs text-muted-foreground">{transactions.length} transaction(s)</p>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchData} className="h-8 w-8 rounded-full">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>

        {/* Simulation Buttons */}
        {cards.length > 0 && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs border-dashed border-slate-300 dark:border-slate-700 hover:border-primary hover:bg-primary/5"
              onClick={() => setPurchaseDialogOpen(true)}
            >
              <ShoppingCart className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
              Simulate Purchase
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs border-dashed border-slate-300 dark:border-slate-700 hover:border-primary hover:bg-primary/5"
              onClick={() => setPaymentDialogOpen(true)}
            >
              <Banknote className="h-3.5 w-3.5 mr-1.5 text-green-500" />
              Make Payment
            </Button>
          </div>
        )}
      </div>

      {/* Scrollable Transactions List */}
      <div className="flex-1 overflow-y-auto p-4 pt-2 min-h-0">
        {transactions.length === 0 ? (
          <Card className="border-dashed border-2 shadow-none bg-transparent">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                <Receipt className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-sm">No transactions yet</p>
              <p className="text-xs text-muted-foreground text-center mt-1">
                {cards.length > 0
                  ? 'Simulate purchases above to populate history'
                  : 'Get a card first to start transacting'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => {
              const isPayment = tx.type === 'payment';
              const card = cards.find((c) => c.cardId);
              const cardLabel = card ? `•••• ${tx.transactionId.slice(-4)}` : '';
              return (
                <Card key={tx.transactionId} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                            isPayment ? 'bg-green-100 dark:bg-green-900/30' : 'bg-orange-100 dark:bg-orange-900/30'
                          }`}
                        >
                          {isPayment ? (
                            <ArrowDownLeft className="h-5 w-5 text-green-600 dark:text-green-400" />
                          ) : (
                            <ArrowUpRight className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate text-slate-900 dark:text-slate-100">
                            {tx.merchant || (isPayment ? 'Payment' : 'Purchase')}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">{cardLabel}</span>
                            <span className="text-[10px] text-muted-foreground">•</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(tx.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold text-sm ${isPayment ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>
                          {isPayment ? '+' : '-'}${Math.abs(tx.amount).toLocaleString()}
                        </p>
                        {tx.scoreImpact !== undefined && tx.scoreImpact !== 0 && (
                          <Badge
                            variant="outline"
                            className={`text-[9px] h-4 px-1 mt-1 border-0 ${
                              tx.scoreImpact > 0 
                                ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}
                          >
                            Score {tx.scoreImpact > 0 ? '↑' : '↓'}{Math.abs(tx.scoreImpact)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Purchase Dialog */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Simulate Purchase
            </DialogTitle>
            <DialogDescription>
              Simulate a purchase to test your card and see balance changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Card selection (buttons) */}
            {cards.length > 1 && (
              <div className="space-y-2">
                <Label>Card</Label>
                <div className="flex flex-wrap gap-1">
                  {cards.map((card) => (
                    <Button
                      key={card.cardId}
                      type="button"
                      size="sm"
                      variant={selectedCardId === card.cardId ? 'default' : 'outline'}
                      className="text-xs h-7"
                      onClick={() => setSelectedCardId(card.cardId)}
                    >
                      {card.type} •••{card.cardId.slice(-4)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {selectedCard && (
              <p className="text-xs text-muted-foreground">
                Available: ${selectedCard.availableCredit.toLocaleString()}
              </p>
            )}
            {/* Merchant selection (buttons) */}
            <div className="space-y-2">
              <Label>Merchant</Label>
              <div className="flex flex-wrap gap-1">
                {MERCHANTS.map((m) => (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant={merchant === m ? 'default' : 'outline'}
                    className="text-xs h-6 px-2"
                    onClick={() => setMerchant(m)}
                  >
                    {m}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                max={selectedCard?.availableCredit || 10000}
                placeholder="50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {/* Quick amounts */}
              <div className="flex gap-1">
                {[25, 50, 100, 200].map((a) => (
                  <Button
                    key={a}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-6 flex-1"
                    onClick={() => setAmount(a.toString())}
                  >
                    ${a}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPurchaseDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handlePurchase} disabled={processing || !amount}>
              {processing ? 'Processing...' : 'Make Purchase'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Make Payment
            </DialogTitle>
            <DialogDescription>
              Make a payment on your card. On-time payments boost your score!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Card selection (buttons) */}
            {cards.length > 1 && (
              <div className="space-y-2">
                <Label>Card</Label>
                <div className="flex flex-wrap gap-1">
                  {cards.map((card) => (
                    <Button
                      key={card.cardId}
                      type="button"
                      size="sm"
                      variant={selectedCardId === card.cardId ? 'default' : 'outline'}
                      className="text-xs h-7"
                      onClick={() => setSelectedCardId(card.cardId)}
                    >
                      {card.type} •••{card.cardId.slice(-4)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {selectedCard && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Balance: ${selectedCard.balance.toLocaleString()}</p>
                <p>Minimum: ${selectedCard.minimumPayment.toLocaleString()}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="paymentAmount">Amount ($)</Label>
              <Input
                id="paymentAmount"
                type="number"
                min="1"
                max={selectedCard?.balance || 10000}
                placeholder={selectedCard?.minimumPayment?.toString() || '50'}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {/* Quick amounts */}
              {selectedCard && selectedCard.balance > 0 && (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-6 flex-1"
                    onClick={() => setAmount(selectedCard.minimumPayment.toString())}
                  >
                    Min ${selectedCard.minimumPayment}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-6 flex-1"
                    onClick={() => setAmount(selectedCard.balance.toString())}
                  >
                    Full ${selectedCard.balance}
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handlePayment} disabled={processing || !amount}>
              {processing ? 'Processing...' : 'Make Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
