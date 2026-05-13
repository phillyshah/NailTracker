import { cn } from '../utils/cn';

interface Props {
  expDate: string | null;
  className?: string;
  showDate?: boolean; // always render the date (for table columns)
}

export function ExpiryBadge({ expDate, className, showDate = false }: Props) {
  if (!expDate) return showDate ? <span className="text-sm text-gray-400">—</span> : null;

  const exp = new Date(expDate);
  const now = new Date();
  const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const dateStr = exp.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  // Not urgent — show plain date if in a table column, otherwise hide
  if (diffDays > 180) {
    if (!showDate) return null;
    return <span className={cn('text-sm text-gray-600', className)}>{dateStr}</span>;
  }

  // Urgent — always show as colored badge
  let style: string;
  if (diffDays < 0) {
    style = 'bg-red-100 text-red-700 border-red-200';
  } else if (diffDays <= 90) {
    style = 'bg-red-100 text-red-700 border-red-200';
  } else {
    style = 'bg-yellow-100 text-yellow-700 border-yellow-200';
  }

  const label = diffDays < 0 ? 'Expired' : dateStr;

  return (
    <span className={cn('inline-block rounded-full border px-3 py-1 text-sm font-semibold', style, className)}>
      {label}
    </span>
  );
}
