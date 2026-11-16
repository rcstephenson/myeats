export interface MealGroupHeaderProps {
  name: string;
  kcal?: string;
}

/** Indented sub-header inside a category for a saved-meal log. */
export function MealGroupHeader({ name, kcal }: MealGroupHeaderProps) {
  return (
    <div className="flex min-h-9 items-center justify-between border-b border-hairline bg-surface pl-8 pr-gutter">
      <span className="truncate text-xs font-semibold text-ink">{name}</span>
      {kcal ? <span className="num text-xs text-muted">{kcal}</span> : null}
    </div>
  );
}
