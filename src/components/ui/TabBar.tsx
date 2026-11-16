import { NavLink } from 'react-router-dom';
import { BookOpen, LineChart, NotebookText, Scale } from 'lucide-react';

const tabs = [
  { to: '/', label: 'Diary', Icon: NotebookText, end: true },
  { to: '/foods', label: 'Foods', Icon: BookOpen, end: false },
  { to: '/weight', label: 'Weight', Icon: Scale, end: false },
  { to: '/trends', label: 'Trends', Icon: LineChart, end: false },
] as const;

export function TabBar() {
  return (
    <nav
      aria-label="Primary"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface"
    >
      <ul className="mx-auto flex max-w-app">
        {tabs.map(({ to, label, Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'relative flex min-h-[56px] flex-col items-center justify-center gap-1',
                  'font-mono text-micro font-medium uppercase tracking-micro',
                  isActive ? 'text-ink' : 'text-muted',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <span
                      aria-hidden="true"
                      data-testid="tab-tick"
                      className="absolute inset-x-5 -top-px h-0.5 bg-accent-ink"
                    />
                  ) : null}
                  <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} aria-hidden="true" />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
