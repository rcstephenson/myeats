import { Button } from './Button';

export interface AddedFooterProps {
  /** Category name, e.g. "Breakfast". */
  category: string;
  count: number;
  /** Pre-formatted, e.g. "424 kcal". */
  kcal: string;
  onDone: () => void;
}

export function AddedFooter({ category, count, kcal, onDone }: AddedFooterProps) {
  return (
    <div className="pb-safe flex items-center justify-between gap-3 border-t border-hairline bg-raised pl-gutter pr-2">
      <span className="micro num truncate text-ink">
        {category} · {count} added · {kcal}
      </span>
      <Button variant="ghost" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
