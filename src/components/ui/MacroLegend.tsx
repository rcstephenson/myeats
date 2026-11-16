const ITEMS = [
  ['P', 'bg-protein', 'Protein'],
  ['C', 'bg-carbs', 'Carbs'],
  ['F', 'bg-fat', 'Fat'],
] as const;

export function MacroLegend({ className = '' }: { className?: string }) {
  return (
    <ul className={`flex items-center gap-4 ${className}`} aria-label="Macro legend">
      {ITEMS.map(([short, bg, full]) => (
        <li key={short} className="flex items-center gap-1.5 text-xs text-muted">
          <span aria-hidden="true" className={`h-2 w-2 rounded-[1px] ${bg}`} />
          <span title={full}>{short}</span>
        </li>
      ))}
    </ul>
  );
}
