import { useState, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface HelpBannerProps {
  storageKey: string;
  children: React.ReactNode;
}

export function HelpBanner({ storageKey, children }: HelpBannerProps) {
  const key = `help-dismissed-${storageKey}`;
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(key) === '1');

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(key, '1');
  }

  function show() {
    setDismissed(false);
    localStorage.removeItem(key);
  }

  if (dismissed) {
    return (
      <button
        onClick={show}
        className="mb-3 flex items-center gap-1.5 text-sm text-primary-500 hover:text-primary-700"
        aria-label="Show help"
      >
        <HelpCircle size={18} />
        <span>Help</span>
      </button>
    );
  }

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
      <HelpCircle size={20} className="shrink-0 text-blue-500 mt-0.5" />
      <div className="flex-1 text-sm text-blue-800">{children}</div>
      <button
        onClick={dismiss}
        className="shrink-0 rounded-lg p-1 text-blue-400 hover:text-blue-600 hover:bg-blue-100"
        aria-label="Dismiss help"
      >
        <X size={18} />
      </button>
    </div>
  );
}
