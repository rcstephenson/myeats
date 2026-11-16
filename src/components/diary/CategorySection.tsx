import { useRef, type ReactNode } from 'react';
import { isIncomplete, netCarbs } from '../../domain/nutrients';
import { amountLabel, formatGrams, formatKcal } from '../../domain/units';
import type { Category, Entry } from '../../domain/types';
import { CategoryHeader, EntryRow, MealGroupHeader, Menu, type MenuItem } from '../ui';
import { categoryKcal, groupBlocks } from './model';

export interface CategorySectionProps {
  category: Category;
  entries: readonly Entry[];
  readOnly: boolean;
  menuItems: MenuItem[];
  onAdd?: () => void;
  onSelect?: (entry: Entry) => void;
  /** Read-only days: copy an entry to today straight from its visible menu. */
  onEntryCopy?: (entry: Entry) => void;
  /** Read-only days: long-press offers the same action in a sheet. */
  onEntryLongPress?: (entry: Entry) => void;
}

function rowProps(e: Entry) {
  const n = e.nutrients;
  return {
    name: e.name,
    brand: e.brand ?? undefined,
    amount: e.amount !== null && e.unitLabel ? amountLabel(e.amount, e.unitLabel) : '',
    kcal: `${e.kcalDerived ? '≈' : ''}${formatKcal(n.kcal ?? 0)}`,
    protein: formatGrams(n.protein ?? 0),
    carbs: formatGrams(netCarbs(n)),
    fat: formatGrams(n.fat ?? 0),
    incomplete: isIncomplete(n),
  };
}

const LONG_PRESS_MS = 500;

/** Long-press wrapper (SPEC 3.1.5): fires `onLongPress` after 500 ms without moving. */
function LongPress({ onLongPress, children }: { onLongPress: () => void; children: ReactNode }) {
  const timer = useRef<number | undefined>(undefined);
  const cancel = () => window.clearTimeout(timer.current);
  return (
    <div
      onPointerDown={() => {
        cancel();
        timer.current = window.setTimeout(onLongPress, LONG_PRESS_MS);
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onPointerMove={cancel}
      onContextMenu={(e) => {
        e.preventDefault();
        cancel();
        onLongPress();
      }}
    >
      {children}
    </div>
  );
}

/** One category: header with subtotal, add and menu, then its entries (SPEC 3.1.2). */
export function CategorySection({
  category,
  entries,
  readOnly,
  menuItems,
  onAdd,
  onSelect,
  onEntryCopy,
  onEntryLongPress,
}: CategorySectionProps) {
  const blocks = groupBlocks(entries);
  const subtotal = entries.length > 0 ? `${formatKcal(categoryKcal(entries))} kcal` : undefined;

  const row = (e: Entry, indent: boolean) => {
    const props = rowProps(e);
    if (readOnly) {
      return (
        <LongPress key={e.id} onLongPress={() => onEntryLongPress?.(e)}>
          <EntryRow
            {...props}
            indent={indent}
            disabled
            menu={
              <Menu
                label={`${e.name} options`}
                items={[{ label: 'Copy to today', onSelect: () => onEntryCopy?.(e) }]}
              />
            }
          />
        </LongPress>
      );
    }
    return <EntryRow key={e.id} {...props} indent={indent} onSelect={() => onSelect?.(e)} />;
  };

  return (
    <section aria-label={category.name} className="mt-4">
      <CategoryHeader
        name={category.name}
        kcal={subtotal}
        onAdd={readOnly ? undefined : onAdd}
        menu={<Menu label={`${category.name} options`} items={menuItems} />}
      />
      {blocks.map((b) =>
        b.type === 'entry' ? (
          row(b.entry, false)
        ) : (
          <div key={b.mealLogId} role="group" aria-label={b.name}>
            <MealGroupHeader name={b.name} kcal={`${formatKcal(b.kcal)} kcal`} />
            {b.entries.map((e) => row(e, true))}
          </div>
        ),
      )}
    </section>
  );
}
