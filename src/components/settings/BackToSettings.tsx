import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

/** Leading back control for the sub-screens of Settings. */
export function BackToSettings() {
  return (
    <Link
      to="/settings"
      aria-label="Back to Settings"
      className="-ml-2 inline-flex min-h-touch min-w-touch items-center justify-center rounded-btn text-muted"
    >
      <ChevronLeft size={24} aria-hidden="true" />
    </Link>
  );
}
