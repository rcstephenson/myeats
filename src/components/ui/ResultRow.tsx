export type SourceTag = 'USDA' | 'OFF' | 'MEAL' | 'RECIPE' | 'CACHED';

export interface ResultRowProps {
  name: string;
  /** Omitted for the user's own foods. */
  tag?: SourceTag;
  brand?: string;
  /** e.g. "100 g" */
  amount: string;
  /** Pre-formatted, e.g. "165 kcal" */
  kcal: string;
  onSelect: () => void;
}

/** Fixed 56px search result row. */
export function ResultRow({ name, tag, brand, amount, kcal, onSelect }: ResultRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex h-14 w-full items-center gap-3 border-b border-hairline px-gutter text-left active:bg-surface"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-ink">{name}</span>
        <span className="flex items-center gap-2">
          {tag ? <span className="micro shrink-0 text-[10px] leading-4">{tag}</span> : null}
          {brand ? <span className="truncate text-xs text-muted">{brand}</span> : null}
        </span>
      </span>
      <span className="num flex shrink-0 flex-col items-end text-xs">
        <span className="text-ink">{kcal}</span>
        <span className="text-muted">{amount}</span>
      </span>
    </button>
  );
}
