import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, X } from 'lucide-react';

interface Toast {
  id: number;
  message: string;
}

let toastId = 0;
let addToastExternal: ((message: string) => void) | null = null;

/** Call this from anywhere to show a toast */
export function showToast(message: string) {
  addToastExternal?.(message);
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    addToastExternal = addToast;
    return () => { addToastExternal = null; };
  }, [addToast]);

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(6,78,59,0.25) 100%)',
            borderColor: 'rgba(16,185,129,0.4)',
            boxShadow: '0 0 30px -5px rgba(16,185,129,0.3)',
            animation: 'slide-in-right 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-100">{toast.message}</span>
          <button
            onClick={() => dismiss(toast.id)}
            className="ml-2 shrink-0 rounded-full p-1 text-emerald-300/60 transition-colors hover:bg-white/10 hover:text-emerald-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
