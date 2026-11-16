import type { ReactNode } from 'react';

export interface EntryRowProps {
  name: string;
  brand?: string;
  /** e.g. "150 g" */
  amount: string;
  /** Pre-formatted, e.g. "245" */
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  incomplete?: boolean;
  /** Read-only: renders a non-interactive row. */
  disabled?: boolean;
  onSelect?: () => void;
  /** Optional trailing slot (e.g. a Menu trigger). */
  menu?: ReactNode;
  /** Indent under a MealGroupHeader. */
  indent?: boolean;
}

export function EntryRow({
  name,
  brand,
  amount,
  kcal,
  protein,
  carbs,
  fat,
  incomplete,
  disabled,
  onSelect,
  menu,
  indent,
}: EntryRowProps) {
  const body = (
    <>
      <span className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm text-ink">{name}</span>
          {brand ? <span className="truncate text-xs text-muted">{brand}</span> : null}
        </span>
        <span className="num flex shrink-0 items-baseline gap-1 text-sm text-ink">
          {incomplete ? (
            <span role="img" aria-label="Some nutrients missing" className="text-muted">
              ~
            </span>
          ) : null}
          {kcal}
        </span>
      </span>
      <span className="num flex items-baseline justify-between gap-3 text-xs text-muted">
        <span>{amount}</span>
        <span>
          P {protein} · C {carbs} · F {fat}
        </span>
      </span>
    </>
  );
  const pad = `${indent ? 'pl-8' : 'pl-gutter'} ${menu ? 'pr-1' : 'pr-gutter'}`;
  return (
    <div className="flex min-h-14 items-stretch border-b border-hairline">
      {disabled || !onSelect ? (
        <div className={`flex min-w-0 flex-1 flex-col justify-center py-2 ${pad}`}>{body}</div>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className={`flex min-w-0 flex-1 flex-col justify-center py-2 text-left active:bg-surface ${pad}`}
        >
          {body}
        </button>
      )}
      {menu ? <div className="flex shrink-0 items-center">{menu}</div> : null}
    </div>
  );
}
