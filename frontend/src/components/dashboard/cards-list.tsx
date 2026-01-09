import Link from 'next/link';
import { CreditCard, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Card as CardType } from '@/types';

interface CardsListProps {
  cards: CardType[];
}

export function CardsList({ cards }: CardsListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">My Cards</h2>
        <Link href="/cards">
          <Button variant="ghost" size="sm" className="h-6 text-xs hover:bg-transparent hover:text-primary p-0">
            View All <ChevronRight className="ml-0.5 h-3 w-3" />
          </Button>
        </Link>
      </div>

      {cards.length === 0 ? (
        <Card className="border-dashed border-2 bg-slate-50/50 dark:bg-slate-900/50 shadow-none">
          <CardContent className="py-6 text-center">
            <div className="mx-auto w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No cards yet</p>
            <Link href="/offers" className="block mt-3">
              <Button size="sm" className="h-8 text-xs w-full max-w-[140px]">
                Find Offers
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {cards.map((card) => (
            <Link href="/cards" key={card.cardId} className="block group">
              <Card className="overflow-hidden transition-all hover:shadow-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                <CardContent className="p-0">
                  <div className="flex h-20">
                    {/* Visual Strip - Neutral/Grayscale */}
                    <div className={`w-1.5 h-full ${
                      card.status === 'active' 
                        ? 'bg-slate-600 dark:bg-slate-400' 
                        : 'bg-slate-300 dark:bg-slate-700'
                    }`} />
                    
                    <div className="flex-1 p-3 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            {card.type}
                          </p>
                          <p className="text-sm font-semibold tabular-nums mt-0.5 text-slate-900 dark:text-white">
                            •••• {card.cardId.slice(-4)}
                          </p>
                        </div>
                        <Badge 
                          variant="outline"
                          className="text-[10px] h-5 px-1.5 font-normal border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                        >
                          {card.status}
                        </Badge>
                      </div>
                      
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Balance</p>
                          <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                            ${card.balance.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground">Available</p>
                          <p className="text-sm font-medium tabular-nums text-slate-600 dark:text-slate-400">
                            ${card.availableCredit.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
