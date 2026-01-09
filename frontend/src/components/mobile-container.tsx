'use client';

import type { ReactNode } from 'react';

interface MobileContainerProps {
  children: ReactNode;
}

export function MobileContainer({ children }: MobileContainerProps) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-[430px] h-[85vh] max-h-[844px] bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col relative">
        {children}
      </div>
    </div>
  );
}
