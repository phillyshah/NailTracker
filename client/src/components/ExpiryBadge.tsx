import { cn } from '../utils/cn';
import { formatExpiry, daysUntilExpiry } from '../utils/expiry';

interface Props {
  expDate: string | null;
  className?: string;
  showDate?: boolean; // always render the date (for table columns)
}

export function ExpiryBadge({ expDate, className, showDate = false }: Props) {
  if (!expDate) return showDate ? <span className="text-sm text-gray-400">—</span> : null;

  // Expiry is UTC-canonical — format and compare in UTC (see utils/expiry.ts).
  const diffDays = daysUntilExpiry(expDate) ?? 0;
  const dateStr = formatExpiry(expDate);

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
