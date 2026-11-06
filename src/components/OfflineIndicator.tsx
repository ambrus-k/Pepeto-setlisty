import React from 'react';
import { WifiOff, Database } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2.5 rounded-xl bg-amber-500/95 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-xl border border-amber-400">
      <WifiOff className="w-4 h-4 text-slate-950" />
      <span>Režim offline</span>
      <span className="text-amber-950/70 font-normal">|</span>
      <span className="flex items-center gap-1 font-normal text-amber-950">
        <Database className="w-3.5 h-3.5" />
        Používají se data z IndexedDB
      </span>
    </div>
  );
};
