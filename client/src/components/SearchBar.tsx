import { Search, Filter, X } from 'lucide-react';
import { cn } from '../utils/cn';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Called on Enter — use for server-side search pages (Inventory, Distributor
   *  detail). In-browser filtered lists can omit this and filter on `onChange`. */
  onSubmit?: () => void;
  /** Shows a clear (X) button when there's text; falls back to clearing `value`. */
  onClear?: () => void;
  /** Optional filter funnel button (Inventory's advanced filters). */
  showFilterButton?: boolean;
  filterActive?: boolean;
  onToggleFilter?: () => void;
  className?: string;
}

/**
 * Shared search input used across the app (Inventory, Transfer, Bank picker,
 * Distributor detail) so the quick-find box looks and behaves identically
 * everywhere. Markup lifted from the original Inventory search bar.
 */
export function SearchBar({
  value,
  onChange,
  placeholder = 'Search item number, lot, or product...',
  onSubmit,
  onClear,
  showFilterButton = false,
  filterActive = false,
  onToggleFilter,
  className,
}: SearchBarProps) {
  function handleClear() {
    if (onClear) onClear();
    else onChange('');
  }

  return (
    <div className={cn('flex gap-2', className)}>
      <div className="relative flex-1">
        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit?.()}
          placeholder={placeholder}
          className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-10 text-base focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none"
        />
        {value && (
          <button
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        )}
      </div>
      {showFilterButton && (
        <button
          onClick={onToggleFilter}
          aria-label="Filters"
          className={cn(
            'rounded-xl border px-3 py-2.5',
            filterActive
              ? 'border-primary-400 bg-primary-50 text-primary-700'
              : 'border-gray-300 text-gray-600 hover:bg-gray-100',
          )}
        >
          <Filter size={20} />
        </button>
      )}
    </div>
  );
}
