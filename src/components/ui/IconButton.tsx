import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required accessible name. */
  'aria-label': string;
  children: ReactNode;
}

/** 48px square icon-only button. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className = '', type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex h-12 w-12 shrink-0 select-none items-center justify-center rounded-btn text-ink transition-opacity active:opacity-60 disabled:opacity-40 ${className}`}
      {...rest}
    />
  );
});
