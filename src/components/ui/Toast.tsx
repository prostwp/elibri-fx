import type {} from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

// ─── Toast Store ────────────────────────────────
interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  add: (type: ToastItem['type'], message: string) => void;
  remove: (id: number) => void;
}

let toastId = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (type, message) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// Shorthand
export const toast = {
  success: (msg: string) => useToastStore.getState().add('success', msg),
  error: (msg: string) => useToastStore.getState().add('error', msg),
  info: (msg: string) => useToastStore.getState().add('info', msg),
  warning: (msg: string) => useToastStore.getState().add('warning', msg),
};

// ─── Toast Container ────────────────────────────
export function ToastContainer() {
  const { toasts, remove } = useToastStore();

  if (toasts.length === 0) return null;

  const icons = {
    success: <CheckCircle className="h-4 w-4 text-emerald-400" />,
    error: <AlertCircle className="h-4 w-4 text-red-400" />,
    info: <Info className="h-4 w-4 text-blue-400" />,
    warning: <AlertCircle className="h-4 w-4 text-amber-400" />,
  };

  const colors = {
    success: 'border-emerald-500/20 bg-emerald-500/10',
    error: 'border-red-500/20 bg-red-500/10',
    info: 'border-blue-500/20 bg-blue-500/10',
    warning: 'border-amber-500/20 bg-amber-500/10',
  };

  return createPortal(
    <div className="fixed top-4 right-4 z-[10000] space-y-2 pointer-events-none" style={{ maxWidth: 360 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2 rounded-lg border px-3 py-2.5 shadow-xl backdrop-blur-sm animate-slide-in ${colors[t.type]}`}
        >
          {icons[t.type]}
          <span className="text-xs text-white flex-1">{t.message}</span>
          <button onClick={() => remove(t.id)} className="text-gray-500 hover:text-white transition">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
