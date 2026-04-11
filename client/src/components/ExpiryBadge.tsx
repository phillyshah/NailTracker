import { cn } from '../utils/cn';

interface Props {
  expDate: string | null;
  className?: string;
}

export function ExpiryBadge({ expDate, className }: Props) {
  if (!expDate) return null;

  const exp = new Date(expDate);
  const now = new Date();
  const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Only show badge if expired or expiring within 180 days
  if (diffDays > 180) return null;

  let label: string;
  let style: string;

  if (diffDays < 0) {
    label = 'Expired';
    style = 'bg-red-100 text-red-700 border-red-200';
  } else if (diffDays <= 90) {
    label = `${diffDays}d left`;
    style = 'bg-red-100 text-red-700 border-red-200';
  } else {
    label = `${diffDays}d left`;
    style = 'bg-yellow-100 text-yellow-700 border-yellow-200';
  }

  return (
    <span className={cn('inline-block rounded-full border px-3 py-1 text-sm font-semibold', style, className)}>
      {label}
    </span>
  );
}
