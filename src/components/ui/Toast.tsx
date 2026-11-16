import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export const TOAST_MS = 5000;

export interface ToastProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  /** Auto-dismiss delay; default 5000 ms. */
  duration?: number;
  /** Distance from the bottom (CSS length). Default: var(--toast-bottom, 72px). */
  bottom?: string;
}

/** Raised strip: one line plus an optional action. Auto-dismisses. */
export function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
  duration = TOAST_MS,
  bottom,
}: ToastProps) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    const id = setTimeout(() => dismissRef.current(), duration);
    return () => clearTimeout(id);
  }, [duration, message]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-gutter"
      style={{ bottom: bottom ?? 'var(--toast-bottom, 72px)' }}
    >
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex min-h-touch w-full max-w-app items-center justify-between gap-3 rounded-card border border-hairline bg-raised pl-4 text-sm text-ink"
      >
        <span className="truncate py-3">{message}</span>
        {actionLabel ? (
          <button
            type="button"
            onClick={() => {
              onAction?.();
              onDismiss();
            }}
            className="min-h-touch shrink-0 px-4 font-mono text-xs font-medium uppercase tracking-micro text-accent"
          >
            {actionLabel}
          </button>
        ) : (
          <span className="w-4" />
        )}
      </div>
    </div>
  );
}

export interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastCtx {
  show: (t: ToastOptions) => void;
  dismiss: () => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children, bottom }: { children: ReactNode; bottom?: string }) {
  const [toast, setToast] = useState<(ToastOptions & { key: number }) | null>(null);
  const counter = useRef(0);
  const show = useCallback((t: ToastOptions) => {
    counter.current += 1;
    setToast({ ...t, key: counter.current });
  }, []);
  const dismiss = useCallback(() => setToast(null), []);
  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {toast ? (
        <Toast
          key={toast.key}
          message={toast.message}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          onDismiss={dismiss}
          bottom={bottom}
        />
      ) : null}
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
