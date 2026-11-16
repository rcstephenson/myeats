import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Chip } from '../ui';

export const inputClass =
  'h-12 w-full min-w-0 rounded-card border border-hairline-strong bg-raised px-3 text-ink';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
}

/** Labelled text input; 16px font so iOS does not zoom. */
export function TextField({
  label,
  onChange,
  error,
  hint,
  className = '',
  ...rest
}: TextFieldProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="micro mb-1 block">
        {label}
      </label>
      <input
        id={id}
        type="text"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        style={{ fontSize: 16 }}
        {...rest}
      />
      {hint && !error ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="micro mb-1 block">{label}</span>
      {children}
    </div>
  );
}

export interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

/** Two or three exclusive choices as a row of chips. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex gap-2">
      {options.map((o) => (
        <Chip
          key={o.value}
          selected={o.value === value}
          onClick={() => onChange(o.value)}
          className="flex-1"
        >
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

/** Native select styled like the inputs (16px). */
export function SelectField({
  label,
  value,
  options,
  onChange,
  className = '',
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} ${className}`}
      style={{ fontSize: 16 }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
