import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { IconButton } from './IconButton';

export interface CategoryHeaderProps {
  name: string;
  /** Pre-formatted subtotal; hidden when undefined/empty. */
  kcal?: string;
  /** Omitted on read-only (past) days: no add button. */
  onAdd?: () => void;
  /** Slot for a `Menu` trigger. */
  menu?: ReactNode;
}

export function CategoryHeader({ name, kcal, onAdd, menu }: CategoryHeaderProps) {
  return (
    <div className="flex min-h-touch items-center justify-between border-b border-hairline pl-gutter">
      <h3 className="micro text-ink">{name}</h3>
      <div className="flex items-center">
        {kcal ? <span className="num mr-1 text-xs text-muted">{kcal}</span> : null}
        {onAdd ? (
          <IconButton aria-label={`Add to ${name}`} onClick={onAdd}>
            <Plus size={20} aria-hidden="true" />
          </IconButton>
        ) : null}
        {menu}
      </div>
    </div>
  );
}
