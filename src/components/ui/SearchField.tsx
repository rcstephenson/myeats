import { forwardRef, useRef, type InputHTMLAttributes } from 'react';
import { ScanLine, Search, X } from 'lucide-react';
import { IconButton } from './IconButton';

export interface SearchFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value'
> {
  value: string;
  onChange: (value: string) => void;
  onScan?: () => void;
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onChange, onScan, className = '', placeholder = 'Search foods', ...rest },
  ref,
) {
  const inner = useRef<HTMLInputElement | null>(null);
  const setRefs = (el: HTMLInputElement | null) => {
    inner.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };
  return (
    <div
      className={`flex h-12 items-center rounded-card border border-hairline-strong bg-raised ${className}`}
    >
      <Search size={18} aria-hidden="true" className="ml-3 shrink-0 text-muted" />
      <input
        ref={setRefs}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Search foods"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-ink outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        style={{ fontSize: 16 }}
        {...rest}
      />
      {value ? (
        <IconButton
          aria-label="Clear search"
          onClick={() => {
            onChange('');
            inner.current?.focus();
          }}
        >
          <X size={18} aria-hidden="true" />
        </IconButton>
      ) : null}
      {onScan ? (
        <>
          <span aria-hidden="true" className="h-6 w-px bg-hairline" />
          <IconButton aria-label="Scan barcode" onClick={onScan}>
            <ScanLine size={20} aria-hidden="true" />
          </IconButton>
        </>
      ) : null}
    </div>
  );
});
