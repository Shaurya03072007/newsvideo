import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Loader2,
  X,
  Sparkles,
} from 'lucide-react';

export type ToastType = 'success' | 'info' | 'warning' | 'error' | 'loading';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Omit<ToastItem, 'id'>>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newItem: ToastItem = { ...toast, id };

    // Keep at most 2 toasts visible at once so screen never feels cluttered
    setToasts((prev) => [...prev.slice(-1), newItem]);

    const duration = toast.duration ?? (toast.type === 'loading' ? 0 : 2500);
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, [removeToast]);

  const updateToast = useCallback((id: string, updates: Partial<Omit<ToastItem, 'id'>>) => {
    setToasts((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t, ...updates };
        const duration = updates.duration ?? (updated.type === 'loading' ? 0 : 4500);
        if (duration > 0) {
          setTimeout(() => {
            removeToast(id);
          }, duration);
        }
        return updated;
      })
    );
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, updateToast }}>
      {children}
      {/* Toast container floating at top-right */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.94 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={`pointer-events-auto p-4 rounded-xl border shadow-2xl backdrop-blur-xl relative overflow-hidden transition-all ${
                toast.type === 'success'
                  ? 'bg-slate-900/95 border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.2)] text-emerald-50'
                  : toast.type === 'warning'
                  ? 'bg-slate-900/95 border-amber-500/50 shadow-[0_0_25px_rgba(245,158,11,0.2)] text-amber-50'
                  : toast.type === 'error'
                  ? 'bg-slate-900/95 border-rose-500/50 shadow-[0_0_25px_rgba(244,63,94,0.25)] text-rose-50'
                  : toast.type === 'loading'
                  ? 'bg-slate-900/95 border-cyan-500/50 shadow-[0_0_25px_rgba(6,182,212,0.25)] text-cyan-50'
                  : 'bg-slate-900/95 border-slate-700/80 shadow-[0_0_25px_rgba(0,0,0,0.5)] text-slate-100'
              }`}
            >
              {/* Top ambient color bar */}
              <div
                className={`absolute top-0 left-0 right-0 h-1 ${
                  toast.type === 'success'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : toast.type === 'warning'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                    : toast.type === 'error'
                    ? 'bg-gradient-to-r from-rose-500 to-red-400'
                    : toast.type === 'loading'
                    ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 animate-pulse'
                    : 'bg-gradient-to-r from-slate-500 to-slate-400'
                }`}
              />

              <div className="flex items-start gap-3 mt-0.5">
                <div className="shrink-0 mt-0.5">
                  {toast.type === 'success' && (
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                  {toast.type === 'warning' && (
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  )}
                  {toast.type === 'error' && (
                    <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                      <XCircle className="w-4 h-4" />
                    </div>
                  )}
                  {toast.type === 'loading' && (
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  )}
                  {toast.type === 'info' && (
                    <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                      <Info className="w-4 h-4" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 pr-2">
                  <h4 className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5">
                    {toast.title}
                    {toast.type === 'success' && <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </h4>
                  {toast.message && (
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed font-telugu-sans">
                      {toast.message}
                    </p>
                  )}
                  {toast.action && (
                    <button
                      type="button"
                      onClick={() => {
                        toast.action?.onClick();
                        removeToast(toast.id);
                      }}
                      className="mt-2.5 px-3 py-1 rounded-md text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-all border border-white/15 cursor-pointer"
                    >
                      {toast.action.label}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                  aria-label="Dismiss toast"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
