import { Check } from 'lucide-react';
import { cn } from '../utils/cn';

interface SuccessCardProps {
  title: string;
  id?: string; // a record id to highlight (TRF-… / USE-… / AUD-…)
  actions?: React.ReactNode; // button row (use <Button>s)
  children?: React.ReactNode; // description line(s)
  className?: string;
}

/**
 * Shared terminal "done" card for the multi-step flows (Transfer / Usage /
 * Cycle Count) so every success state looks identical. Green is reserved for
 * exactly this — a completed action — never for action buttons.
 */
export function SuccessCard({ title, id, actions, children, className }: SuccessCardProps) {
  return (
    <div className={cn('rounded-2xl bg-white p-6 text-center shadow-sm', className)}>
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
        <Check size={30} />
      </div>
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      {id && <p className="mt-1 font-mono text-base text-green-700">{id}</p>}
      {children && <div className="mt-2 text-base text-gray-600">{children}</div>}
      {actions && (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">{actions}</div>
      )}
    </div>
  );
}
