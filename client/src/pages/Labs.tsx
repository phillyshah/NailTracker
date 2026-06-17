import { useNavigate } from 'react-router';
import { FlaskConical, PackageCheck, ClipboardList, History, ChevronRight } from 'lucide-react';
import { HelpBanner } from '../components/HelpBanner';

interface LabFeature {
  to: string;
  title: string;
  description: string;
  icon: typeof PackageCheck;
}

// Experiments live here while they're in testing. As each graduates out of
// TrackerLabs it moves to its permanent home in the nav.
const features: LabFeature[] = [
  {
    to: '/labs/par-levels',
    title: 'Par Levels & Reorder',
    description:
      'Set a minimum stock level per item (globally or per distributor) and get a reorder report that flags everything running low.',
    icon: PackageCheck,
  },
  {
    to: '/labs/cycle-count',
    title: 'Cycle Count',
    description:
      "Scan a distributor's shelf and reconcile it against the system — see what matches, what's missing, and what's extra, then fix discrepancies in one tap.",
    icon: ClipboardList,
  },
  {
    to: '/labs/audits',
    title: 'Audit History',
    description:
      'Review every past cycle count (AUD-…) with its matched, added, and removed counts.',
    icon: History,
  },
];

export default function Labs() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl">
      <div className="mb-4 flex items-center gap-2">
        <FlaskConical size={22} className="text-primary-600" />
        <h2 className="text-xl font-bold text-gray-900">TrackerLabs</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-700">
          Beta
        </span>
      </div>

      <HelpBanner storageKey="labs">
        TrackerLabs is where new features live while they're being tested. They're
        only visible to admins and may change or have rough edges. Try them out and
        share feedback — once a feature is solid it graduates to the main menu.
      </HelpBanner>

      <div className="space-y-3">
        {features.map((f) => (
          <button
            key={f.to}
            onClick={() => navigate(f.to)}
            className="flex w-full items-center gap-4 rounded-2xl bg-white p-5 text-left shadow-sm hover:bg-gray-50"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
              <f.icon size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900">{f.title}</h3>
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                  Beta
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">{f.description}</p>
            </div>
            <ChevronRight size={20} className="shrink-0 text-gray-400" />
          </button>
        ))}
      </div>
    </div>
  );
}
