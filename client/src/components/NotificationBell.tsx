import { useState, useEffect, useRef } from 'react';
import { Bell, X } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { ExpiryBadge } from './ExpiryBadge';
import { cn } from '../utils/cn';

export function NotificationBell() {
  const { unread, unreadCount, dismissNotification, dismissAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 sm:w-96 rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-sm font-semibold text-gray-900">Expiry Alerts</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 1 && (
                <button
                  onClick={dismissAll}
                  className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                >
                  Dismiss all
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {unread.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              No items expiring within 90 days
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100">
              {unread.map((item) => (
                <NotificationRow
                  key={item.udi}
                  item={item}
                  onDismiss={() => dismissNotification(item.udi)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  item,
  onDismiss,
}: {
  item: { udi: string; productLabel: string | null; distributorName: string | null; expDate: string; daysUntilExpiry: number };
  onDismiss: () => void;
}) {
  const urgent = item.daysUntilExpiry <= 30;

  return (
    <li className={cn('flex items-start gap-3 px-4 py-3', urgent && 'bg-red-50')}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {item.productLabel ?? 'Unknown Product'}
        </p>
        <p className="text-xs text-gray-500 truncate">{item.distributorName ?? 'Unassigned'}</p>
        <div className="mt-1">
          <ExpiryBadge expDate={item.expDate} showDate />
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="mt-0.5 shrink-0 rounded-lg p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-500 transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </li>
  );
}
