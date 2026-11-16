import { Chip } from './Chip';

export interface RangeChipsProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}

export function RangeChips<T extends string>({ options, value, onChange }: RangeChipsProps<T>) {
  return (
    <div role="group" aria-label="Range" className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o} selected={o === value} onClick={() => onChange(o)}>
          {o}
        </Chip>
      ))}
    </div>
  );
}
