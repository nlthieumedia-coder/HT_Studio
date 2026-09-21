import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';

interface ToastContextValue { notify: (message: string) => void; }
const ToastContext = createContext<ToastContextValue | null>(null);
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<Array<{ id: number; message: string }>>([]);
  const notify = useCallback((message: string) => { const id = Date.now(); setMessages((items) => [...items, { id, message }]); window.setTimeout(() => setMessages((items) => items.filter((item) => item.id !== id)), 3500); }, []);
  const value = useMemo(() => ({ notify }), [notify]);
  return <ToastContext.Provider value={value}>{children}<div className="toast-stack" aria-live="polite">{messages.map((item) => <div className="toast" key={item.id}><CheckCircle2 size={15} /><span>{item.message}</span><button aria-label="Dismiss notification" onClick={() => setMessages((items) => items.filter((entry) => entry.id !== item.id))}><X size={14} /></button></div>)}</div></ToastContext.Provider>;
};
export const useToast = (): ToastContextValue => { const value = useContext(ToastContext); if (!value) throw new Error('useToast must be used inside ToastProvider'); return value; };
