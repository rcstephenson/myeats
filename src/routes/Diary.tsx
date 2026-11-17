import { useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import * as entryRepo from '../db/repositories/entries';
import * as settingsRepo from '../db/repositories/settings';
import { activeCategories, defaultCategory } from '../domain/categories';
import { dayTotals } from '../domain/weekly';
import type { Category, Entry } from '../domain/types';
import { AddOverlay, type AddOverlayHandle } from '../components/add/AddOverlay';
import { CategorySection } from '../components/diary/CategorySection';
import { DiaryHeader } from '../components/diary/DiaryHeader';
import { EntrySheet } from '../components/diary/EntrySheet';
import { planCopy, shiftDate, shortDateLabel, visibleCategories } from '../components/diary/model';
import { SummaryCard } from '../components/diary/SummaryCard';
import { buttonClass, ConfirmDialog, Sheet, useToast, Button, type MenuItem } from '../components/ui';
import { useCategories } from '../hooks/useCategories';
import { useDay } from '../hooks/useDay';
import { useGoalFor } from '../hooks/useGoalFor';
import { useSettings } from '../hooks/useSettings';
import { useToday } from '../hooks/useToday';
import { fromDateKey, nowIso } from '../lib/dates';
import { newId } from '../lib/ids';

const NONE: Entry[] = [];

export default function Diary() {
  const { date: dateParam } = useParams();
  const today = useToday();
  const navigate = useNavigate();
  const toast = useToast();
  const overlay = useRef<AddOverlayHandle>(null);

  const date = dateParam ?? today;
  const isToday = date === today;
  const yesterday = shiftDate(today, -1);

  const dayEntries = useDay(date);
  const todayEntries = useDay(today);
  const yesterdayEntries = useDay(yesterday);
  const goal = useGoalFor(date);
  const allCategories = useCategories({ includeArchived: true });
  const settings = useSettings();

  const [editing, setEditing] = useState<Entry | null>(null);
  const [clearing, setClearing] = useState<Category | null>(null);
  const [copying, setCopying] = useState<Entry | null>(null);

  const entries = dayEntries ?? NONE;
  const totals = useMemo(() => dayTotals(date, entries), [date, entries]);
  const categories = useMemo(
    () => visibleCategories(allCategories ?? [], entries),
    [allCategories, entries],
  );

  // Today (or a malformed / future date) lives at "/".
  if (dateParam !== undefined && (fromDateKey(dateParam) === null || dateParam >= today)) {
    return <Navigate to="/" replace />;
  }

  const undoToast = (message: string, record: Promise<entryRepo.UndoRecord>) => {
    toast.show({
      message,
      actionLabel: 'Undo',
      onAction: () => void record.then((r) => entryRepo.undo(r)),
    });
  };

  const nextOrderToday = (categoryId: string): number =>
    (todayEntries ?? NONE).reduce(
      (m, e) => (e.categoryId === categoryId ? Math.max(m, e.order) : m),
      0,
    ) + 1;

  /** A past entry's category if it is still active, else the time-of-day default. */
  const targetCategory = (categoryId: string): Category | null => {
    const active = activeCategories(allCategories ?? []);
    return active.find((c) => c.id === categoryId) ?? defaultCategory(new Date(), active);
  };

  const copyInto = (source: readonly Entry[], target: Category, message: string) => {
    if (source.length === 0) return;
    const list = planCopy(
      source,
      { date: today, categoryId: target.id, startOrder: nextOrderToday(target.id), now: nowIso() },
      newId,
    );
    undoToast(message, entryRepo.add(list));
  };

  const menuFor = (c: Category, list: Entry[]): MenuItem[] => {
    if (!isToday) {
      return [
        {
          label: 'Copy to today',
          disabled: list.length === 0,
          onSelect: () => {
            const target = targetCategory(c.id);
            if (target) copyInto(list, target, `Copied ${c.name} to today`);
          },
        },
      ];
    }
    const yesterdayHere = (yesterdayEntries ?? NONE).filter((e) => e.categoryId === c.id);
    return [
      {
        label: 'Copy from yesterday',
        disabled: yesterdayHere.length === 0,
        onSelect: () => copyInto(yesterdayHere, c, `Copied ${c.name} from yesterday`),
      },
      {
        label: 'Save as meal',
        disabled: list.length === 0,
        onSelect: () => navigate(`/meals/new?fromDate=${date}&category=${encodeURIComponent(c.id)}`),
      },
      { label: 'Clear', danger: true, disabled: list.length === 0, onSelect: () => setClearing(c) },
    ];
  };

  const saveEdited = async (entry: Entry, moved: boolean) => {
    setEditing(null);
    const next = moved ? { ...entry, order: nextOrderToday(entry.categoryId) } : entry;
    await entryRepo.update(next);
  };

  const deleteEntry = (entry: Entry) => {
    setEditing(null);
    undoToast(`Deleted ${entry.name}`, entryRepo.remove([entry.id]));
  };

  const clearCategory = () => {
    if (!clearing) return;
    const c = clearing;
    setClearing(null);
    undoToast(`Cleared ${c.name}`, entryRepo.clearCategory(date, c.id));
  };

  return (
    <div>
      <DiaryHeader date={date} today={today} />

      {isToday ? null : (
        <div className="mx-gutter mb-3 flex items-center justify-between gap-3 rounded-card border border-hairline bg-surface pl-3">
          <p className="micro min-w-0 truncate">Viewing {shortDateLabel(date)} · Read-only</p>
          <Link to="/" className={buttonClass('ghost')}>
            Back to today
          </Link>
        </div>
      )}

      <SummaryCard
        totals={totals}
        goal={goal ?? null}
        moreOpen={settings?.summaryMoreOpen ?? false}
        onToggleMore={() =>
          void settingsRepo.update({ summaryMoreOpen: !(settings?.summaryMoreOpen ?? false) })
        }
      />

      {dayEntries === undefined || allCategories === undefined
        ? null
        : categories.map((c) => {
            const list = entries.filter((e) => e.categoryId === c.id);
            return (
              <CategorySection
                key={c.id}
                category={c}
                entries={list}
                readOnly={!isToday}
                menuItems={menuFor(c, list)}
                onAdd={isToday ? () => overlay.current?.open(c.id) : undefined}
                onSelect={setEditing}
                onEntryCopy={(e) => {
                  const target = targetCategory(e.categoryId);
                  if (target) copyInto([e], target, `Copied ${e.name} to today`);
                }}
                onEntryLongPress={setCopying}
              />
            );
          })}

      {editing ? (
        <EntrySheet
          key={editing.id}
          entry={editing}
          categories={activeCategories(allCategories ?? [])}
          onSave={(e, moved) => void saveEdited(e, moved)}
          onDelete={deleteEntry}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={clearing !== null}
        title={`Clear ${clearing?.name ?? ''}?`}
        message="Removes every entry in this category for the day. You can undo right after."
        confirmLabel="Clear"
        destructive
        onConfirm={clearCategory}
        onCancel={() => setClearing(null)}
      />

      <Sheet open={copying !== null} onClose={() => setCopying(null)} title={copying?.name ?? ''}>
        <Button
          fullWidth
          onClick={() => {
            const e = copying;
            setCopying(null);
            const target = e ? targetCategory(e.categoryId) : null;
            if (e && target) copyInto([e], target, `Copied ${e.name} to today`);
          }}
        >
          Copy to today
        </Button>
      </Sheet>

      {isToday ? <AddOverlay ref={overlay} today={today} entries={todayEntries ?? NONE} /> : null}
    </div>
  );
}
