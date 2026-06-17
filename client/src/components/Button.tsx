import { cn } from '../utils/cn';

type Variant = 'primary' | 'secondary' | 'danger' | 'warning';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

// One place for action-button styling so padding/size/colour stay consistent.
// Colour convention:
//   primary  — advance / confirm / submit (the main action of a screen)
//   secondary— cancel / back / neutral
//   danger   — destructive (delete / remove)
//   warning  — cautionary, reversible (e.g. add-missing-to-source)
// Green is reserved for terminal success states (see SuccessCard), never actions.
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm',
  secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  warning: 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-base',
  lg: 'px-4 py-4 text-base',
};

/**
 * Shared action button. Owns variant + size styling; callers add LAYOUT-only
 * classes (e.g. `w-full`, `flex-1`, `shrink-0`) via `className`. These are
 * appended, not de-duped (cn is plain clsx), so don't pass conflicting
 * colour/padding utilities — use a variant/size instead.
 */
export function Button({ variant = 'primary', size = 'md', type, className, ...props }: ButtonProps) {
  return (
    <button
      // Default to "button" so a Button inside a <form> never submits by accident.
      type={type ?? 'button'}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
