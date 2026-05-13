import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '../utils/cn';

interface Props {
  label: string;
  sortKey: string;
  currentKey: string;
  currentDir: 'asc' | 'desc';
  onSort: (key: string) => void;
  className?: string;
}

export function SortableTh({ label, sortKey, currentKey, currentDir, onSort, className }: Props) {
  const isActive = currentKey === sortKey;
  const Icon = !isActive ? ArrowUpDown : currentDir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 text-left font-medium text-gray-500 hover:text-gray-900"
      >
        {label}
        <Icon size={14} className={cn(isActive ? 'text-primary-600' : 'text-gray-400')} />
      </button>
    </th>
  );
}
