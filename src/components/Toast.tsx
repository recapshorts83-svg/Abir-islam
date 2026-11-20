import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

type ToastTone = 'ok' | 'err' | 'info';

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now();
    setToast({ id, message, tone });
    window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full text-sm font-medium shadow-2xl border backdrop-blur-md transition-opacity duration-150 ${
            toast.tone === 'ok'
              ? 'bg-[#0d192b]/95 border-[#34d399]/50 text-[#a7f3d0]'
              : toast.tone === 'err'
                ? 'bg-[#1f1220]/95 border-[#f87171]/55 text-[#fecaca]'
                : 'bg-[#141a2e]/95 border-white/15 text-[#eaf0ff]'
          }`}
        >
          {toast.tone === 'ok' && <CheckCircle2 className="w-4 h-4 shrink-0 text-[#34d399]" />}
          {toast.tone === 'err' && <AlertCircle className="w-4 h-4 shrink-0 text-[#f87171]" />}
          {toast.tone === 'info' && <Info className="w-4 h-4 shrink-0 text-[#22d3ee]" />}
          <span>{toast.message}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}
