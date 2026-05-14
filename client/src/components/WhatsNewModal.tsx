import { useEffect } from 'react';
import { Sparkles, X, BookOpen } from 'lucide-react';
import { changelog } from '../data/changelog';

const GUIDE_URL = 'https://github.com/phillyshah/NailTracker/raw/main/Nail_Tracker_User_Guide.docx';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function WhatsNewModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const latestEntry = changelog[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[80vh] rounded-t-3xl sm:rounded-2xl bg-white p-5 shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-primary-600" />
            <h3 className="text-lg font-bold text-gray-900">What's New</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-5">
          {changelog.map((entry) => (
            <div key={entry.version}>
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-sm font-bold text-primary-700">
                  v{entry.version}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(entry.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
                {entry.version === latestEntry.version && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Latest
                  </span>
                )}
              </div>
              <ul className="space-y-1">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" />
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t">
          <a
            href={GUIDE_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700"
          >
            <BookOpen size={18} />
            Download User Guide
          </a>
        </div>
      </div>
    </div>
  );
}
