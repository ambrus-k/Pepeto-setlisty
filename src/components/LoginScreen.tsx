import React, { useState, useEffect } from 'react';
import { Music, Lock, Delete, ArrowRight, AlertCircle, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DisplaySettingsModal } from './DisplaySettingsModal';

export const LoginScreen: React.FC = () => {
  const { login, error, clearError } = useAuth();
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Keyboard support for typing PIN
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 8) {
          clearError();
          const newPin = pin + e.key;
          setPin(newPin);
          if (newPin === '2004' || newPin === '251925') {
            attemptLogin(newPin);
          }
        }
      } else if (e.key === 'Backspace') {
        clearError();
        setPin((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        if (pin.length >= 4) {
          handleSubmit();
        }
      } else if (e.key === 'Escape') {
        setPin('');
        clearError();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin]);

  const handleDigit = (digit: string) => {
    if (pin.length < 8) {
      clearError();
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin === '2004' || newPin === '251925') {
        attemptLogin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    clearError();
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    clearError();
    setPin('');
  };

  const attemptLogin = async (pinToTry: string) => {
    setIsSubmitting(true);
    const result = await login(pinToTry);
    setIsSubmitting(false);

    if (!result.success) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin) return;
    attemptLogin(pin);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-indigo-500/30 transition-colors">
      {/* Top-right Display Settings Gear Button */}
      <button
        type="button"
        onClick={() => setIsSettingsOpen(true)}
        className="fixed top-4 right-4 z-20 flex items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 p-2.5 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 shadow-md transition cursor-pointer"
        title="Nastavení zobrazení (velikost písma, tmavý / světlý režim)"
        aria-label="Nastavení zobrazení"
      >
        <Settings className="w-5 h-5" />
      </button>

      {/* Background radial glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl dark:shadow-2xl flex flex-col items-center">
        {/* App Logo */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/30 mb-4 ring-1 ring-white/10">
          <Music className="w-8 h-8" />
        </div>

        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white text-center">
          MobileSheets Setlist Studio
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1 mb-6">
          Zadejte přístupový PIN kód
        </p>

        {/* Secret PIN Dots Display - masked bullet indicators */}
        <div className={`w-full flex flex-col items-center mb-6 ${isShaking ? 'animate-shake' : ''}`}>
          <div className="h-12 w-full flex items-center justify-center gap-2.5 sm:gap-3 bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2">
            {[0, 1, 2, 3, 4, 5].map((idx) => {
              const isFilled = idx < pin.length;
              return (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                    isFilled
                      ? 'bg-gradient-to-tr from-indigo-500 to-violet-400 scale-110 shadow-md shadow-indigo-500/50'
                      : 'border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                />
              );
            })}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 mt-2.5 animate-fadeIn">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Keypad Grid (3x4) */}
        <div className="w-full grid grid-cols-3 gap-2.5 sm:gap-3 mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              disabled={isSubmitting}
              className="h-14 sm:h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/80 active:bg-indigo-600 active:text-white text-xl font-bold text-slate-900 dark:text-white transition-all duration-150 active:scale-95 shadow-sm flex items-center justify-center disabled:opacity-50 cursor-pointer select-none"
            >
              {digit}
            </button>
          ))}

          {/* Clear Button */}
          <button
            type="button"
            onClick={handleClear}
            disabled={isSubmitting || pin.length === 0}
            className="h-14 sm:h-16 rounded-2xl bg-slate-100/70 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 active:bg-slate-300 dark:active:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-all active:scale-95 flex items-center justify-center disabled:opacity-30 cursor-pointer"
          >
            Smazat
          </button>

          {/* Zero Button */}
          <button
            type="button"
            onClick={() => handleDigit('0')}
            disabled={isSubmitting}
            className="h-14 sm:h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/80 active:bg-indigo-600 active:text-white text-xl font-bold text-slate-900 dark:text-white transition-all duration-150 active:scale-95 shadow-sm flex items-center justify-center disabled:opacity-50 cursor-pointer select-none"
          >
            0
          </button>

          {/* Backspace Button */}
          <button
            type="button"
            onClick={handleBackspace}
            disabled={isSubmitting || pin.length === 0}
            className="h-14 sm:h-16 rounded-2xl bg-slate-100/70 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 active:bg-slate-300 dark:active:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-all active:scale-95 flex items-center justify-center disabled:opacity-30 cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Submit Button */}
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={isSubmitting || pin.length < 4}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              <span>Ověřuji PIN...</span>
            </>
          ) : (
            <>
              <span>Vstoupit do aplikace</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Secure Note - No visible PIN hints */}
        <div className="w-full mt-6 pt-5 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          <span>Zabezpečený přístup</span>
        </div>
      </div>

      <DisplaySettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};
