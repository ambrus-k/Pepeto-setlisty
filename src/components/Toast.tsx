import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (item: Omit<ToastItem, 'id'>) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, duration = 4500 }: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const showSuccess = useCallback(
    (message: string, title?: string) => showToast({ type: 'success', title, message }),
    [showToast]
  );

  const showError = useCallback(
    (message: string, title?: string) => showToast({ type: 'error', title, message, duration: 6000 }),
    [showToast]
  );

  const showWarning = useCallback(
    (message: string, title?: string) => showToast({ type: 'warning', title, message, duration: 5000 }),
    [showToast]
  );

  const showInfo = useCallback(
    (message: string, title?: string) => showToast({ type: 'info', title, message }),
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{ showToast, showSuccess, showError, showWarning, showInfo, removeToast }}
    >
      {children}

      {/* Toast Overlay Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3 sm:px-0">
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-xl p-3.5 shadow-2xl border flex items-start gap-3 backdrop-blur-md transition-all animate-fadeIn ${
                isSuccess
                  ? 'bg-white/95 dark:bg-slate-900/95 border-emerald-500/60 text-emerald-950 dark:text-emerald-100 shadow-emerald-950/15 dark:shadow-emerald-950/40'
                  : isError
                  ? 'bg-white/95 dark:bg-slate-900/95 border-rose-500/60 text-rose-950 dark:text-rose-100 shadow-rose-950/15 dark:shadow-rose-950/40'
                  : isWarning
                  ? 'bg-white/95 dark:bg-slate-900/95 border-amber-500/60 text-amber-950 dark:text-amber-100 shadow-amber-950/15 dark:shadow-amber-950/40'
                  : 'bg-white/95 dark:bg-slate-900/95 border-indigo-500/60 text-indigo-950 dark:text-indigo-100 shadow-indigo-950/15 dark:shadow-indigo-950/40'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
                {isError && <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
                {isWarning && <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
                {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
              </div>

              <div className="flex-1 min-w-0">
                {toast.title && (
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-0.5 text-slate-900 dark:text-white">
                    {toast.title}
                  </h4>
                )}
                <p className="text-xs font-medium leading-relaxed text-slate-700 dark:text-slate-200">
                  {toast.message}
                </p>
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
