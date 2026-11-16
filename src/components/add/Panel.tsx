import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { KeyboardActionBar } from '../ui';

export interface PanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Primary action(s), pinned on top of the on-screen keyboard. */
  footer?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog anchored to the TOP of the screen. Panels hold number fields that raise the iOS
 * keyboard; a bottom sheet would sit behind it. Same a11y contract as `Sheet`: focus trap,
 * Escape and backdrop close, focus restore.
 */
export function Panel({ open, onClose, title, children, footer }: PanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // A field with autoFocus already took focus during commit; otherwise focus the first control.
    if (panel && !panel.contains(document.activeElement)) {
      (panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel).focus();
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (!firstEl || !lastEl) {
        e.preventDefault();
        return;
      }
      const active = document.activeElement;
      if (e.shiftKey && (active === firstEl || active === panel)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center" data-panel="">
      <div className="absolute inset-0 bg-scrim" data-testid="panel-backdrop" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="pt-safe relative max-h-[75dvh] w-full max-w-app overflow-y-auto rounded-b-card border border-t-0 border-hairline bg-raised p-gutter"
      >
        <h2 className="mb-3 text-xl font-semibold tracking-tight text-ink">{title}</h2>
        {children}
      </div>
      {footer ? <KeyboardActionBar>{footer}</KeyboardActionBar> : null}
    </div>,
    document.body,
  );
}
