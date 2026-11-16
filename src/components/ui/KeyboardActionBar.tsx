import { useEffect, useState, type ReactNode } from 'react';

export interface KeyboardActionBarProps {
  children: ReactNode;
  className?: string;
}

/** Fixed to the bottom of the visual viewport so it rides on top of the iOS keyboard. */
export function KeyboardActionBar({ children, className = '' }: KeyboardActionBarProps) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setOffset(Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop))));
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return (
    <div
      data-testid="keyboard-action-bar"
      // Keep input focus (and the keyboard) when the bar is pressed so the tap is not lost.
      onPointerDown={(e) => e.preventDefault()}
      className={`fixed inset-x-0 z-50 flex justify-center border-t border-hairline bg-raised ${offset === 0 ? 'pb-safe' : ''} ${className}`}
      style={{ bottom: offset }}
    >
      <div className="flex w-full max-w-app items-center gap-3 p-gutter">{children}</div>
    </div>
  );
}
