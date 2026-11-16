import { useEffect, useState, type FormEvent } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { GripVertical, Trash2 } from 'lucide-react';
import { Button, ConfirmDialog, PageHeader, SectionLabel } from '../components/ui';
import { BackToSettings } from '../components/settings/BackToSettings';
import { categories as categoriesRepo } from '../db/repositories';
import type { Category } from '../domain/types';
import { useCategories } from '../hooks/useCategories';

const inputClass =
  'min-h-touch rounded-btn border border-hairline-strong bg-raised px-3 text-base text-ink';

function CategoryRow({
  category,
  canRemove,
  onRemove,
}: {
  category: Category;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });
  const [name, setName] = useState(category.name);
  useEffect(() => setName(category.name), [category.name]);

  const commitName = () => {
    const next = name.trim();
    if (!next) setName(category.name);
    else if (next !== category.name) void categoriesRepo.rename(category.id, next);
  };

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
        position: 'relative',
        zIndex: isDragging ? 10 : undefined,
      }}
      className={`flex flex-wrap items-center gap-2 border border-hairline bg-surface px-2 py-2 first:rounded-t-card last:rounded-b-card ${
        isDragging ? 'ring-2 ring-accent' : ''
      }`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={`Reorder ${category.name}`}
        className="inline-flex min-h-touch min-w-touch touch-none items-center justify-center rounded-btn text-muted"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={22} aria-hidden="true" />
      </button>
      <input
        aria-label={`Name of ${category.name}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        autoComplete="off"
        className={`${inputClass} min-w-0 flex-1`}
      />
      <input
        type="time"
        aria-label={`Starts at for ${category.name}`}
        value={category.startsAt ?? ''}
        onChange={(e) => void categoriesRepo.setStartsAt(category.id, e.target.value || null)}
        className={`num ${inputClass} w-[7.5rem]`}
      />
      <button
        type="button"
        aria-label={`Remove ${category.name}`}
        disabled={!canRemove}
        onClick={onRemove}
        className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-btn text-muted disabled:opacity-40"
      >
        <Trash2 size={20} aria-hidden="true" />
      </button>
    </li>
  );
}

export default function Categories() {
  const all = useCategories({ includeArchived: true });
  const [newName, setNewName] = useState('');
  const [removing, setRemoving] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!all) return <PageHeader title="Categories" back={<BackToSettings />} />;

  const active = all.filter((c) => c.archivedAt === null);
  const archived = all.filter((c) => c.archivedAt !== null);
  const onlyOne = active.length <= 1;

  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    if (!over || a.id === over.id) return;
    const ids = active.map((c) => c.id);
    const from = ids.indexOf(String(a.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    void categoriesRepo.reorder(arrayMove(ids, from, to));
  };

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await categoriesRepo.add(name);
    setNewName('');
  };

  const confirmRemove = async () => {
    if (!removing) return;
    try {
      await categoriesRepo.archive(removing.id);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
    setRemoving(null);
  };

  return (
    <>
      <PageHeader title="Categories" back={<BackToSettings />} />
      <div className="flex flex-col gap-6 px-gutter pb-6">
        <section aria-label="Active categories" className="flex flex-col gap-2">
          <p className="text-xs text-muted">
            Drag to reorder. The start time picks the default category for new entries.
            {onlyOne
              ? ' At least one category must stay active, so the last one cannot be removed.'
              : ''}
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={active.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col">
                {active.map((c) => (
                  <CategoryRow
                    key={c.id}
                    category={c}
                    canRemove={!onlyOne}
                    onRemove={() => setRemoving(c)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          {error ? (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          ) : null}
        </section>

        <form onSubmit={(e) => void onAdd(e)} className="flex gap-2">
          <input
            aria-label="New category name"
            placeholder="New category"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoComplete="off"
            className={`${inputClass} min-w-0 flex-1`}
          />
          <Button type="submit" disabled={!newName.trim()}>
            Add category
          </Button>
        </form>

        {archived.length > 0 ? (
          <section aria-label="Archived categories" className="flex flex-col gap-2">
            <SectionLabel as="h2">Archived</SectionLabel>
            <ul className="divide-y divide-hairline rounded-card border border-hairline">
              {archived.map((c) => (
                <li key={c.id} className="flex min-h-touch items-center justify-between gap-3 px-3">
                  <span className="text-sm text-muted">{c.name}</span>
                  <Button
                    variant="ghost"
                    aria-label={`Restore ${c.name}`}
                    onClick={() => void categoriesRepo.unarchive(c.id)}
                  >
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? 'category'}?`}
        message="It stays on past days with its name but is hidden from today and the Add screen. You can restore it later."
        confirmLabel="Remove"
        destructive
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}
