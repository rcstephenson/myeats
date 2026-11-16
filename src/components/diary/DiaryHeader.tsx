import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { IconButton } from '../ui';
import { shiftDate, shortDateLabel } from './model';

export interface DiaryHeaderProps {
  date: string;
  today: string;
}

const dayPath = (date: string, today: string): string => (date >= today ? '/' : `/day/${date}`);

/** Date nav (SPEC 3.1.3): prev/next, a native date input behind the label, gear to settings. */
export function DiaryHeader({ date, today }: DiaryHeaderProps) {
  const navigate = useNavigate();
  const isToday = date === today;
  const label = isToday ? `TODAY · ${shortDateLabel(date)}` : shortDateLabel(date);
  return (
    <header className="flex min-h-touch items-center gap-1 px-1 pb-2 pt-3">
      <IconButton
        aria-label="Previous day"
        onClick={() => navigate(dayPath(shiftDate(date, -1), today))}
      >
        <ChevronLeft size={22} aria-hidden="true" />
      </IconButton>
      <div className="relative min-w-0 flex-1 text-center">
        <h1 className="micro truncate py-3 text-ink">{label}</h1>
        {/* The whole label is a transparent date input, so a tap opens the native picker. */}
        <input
          type="date"
          aria-label="Choose date"
          value={date}
          max={today}
          onChange={(e) => {
            const v = e.target.value;
            if (v && v <= today) navigate(dayPath(v, today));
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          style={{ fontSize: 16 }}
        />
      </div>
      <IconButton
        aria-label="Next day"
        disabled={isToday}
        onClick={() => navigate(dayPath(shiftDate(date, 1), today))}
      >
        <ChevronRight size={22} aria-hidden="true" />
      </IconButton>
      <Link
        to="/settings"
        aria-label="Settings"
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-btn text-ink active:opacity-60"
      >
        <Settings size={20} aria-hidden="true" />
      </Link>
    </header>
  );
}
