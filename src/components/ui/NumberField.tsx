import { useState, type InputHTMLAttributes } from 'react';

/** Parses "1,5" / "1.5" / ".5" / "5." to a number; anything else (or empty) is null. */
export function parseDecimal(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (s === '' || s === '.' || !/^\d*\.?\d*$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export interface NumberFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value' | 'defaultValue'
> {
  label: string;
  /** Initial raw text. */
  defaultValue?: string;
  onChange: (value: number | null, raw: string) => void;
  /** Large mono variant for the Amount panel. */
  large?: boolean;
  suffix?: string;
}

export function NumberField({
  label,
  defaultValue = '',
  onChange,
  large,
  suffix,
  className = '',
  ...rest
}: NumberFieldProps) {
  const [raw, setRaw] = useState(defaultValue);
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <input
        type="text"
        inputMode="decimal"
        pattern="[0-9]*[.,]?[0-9]*"
        enterKeyHint="done"
        autoComplete="off"
        aria-label={label}
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          onChange(parseDecimal(e.target.value), e.target.value);
        }}
        className={`num h-12 min-w-0 flex-1 rounded-card border border-hairline-strong bg-raised px-3 text-ink ${large ? 'font-semibold' : ''}`}
        style={{ fontSize: large ? 24 : 16 }}
        {...rest}
      />
      {suffix ? <span className="num text-sm text-muted">{suffix}</span> : null}
    </div>
  );
}
