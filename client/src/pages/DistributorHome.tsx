import { useNavigate } from 'react-router';
import { ClipboardList, Package, ClipboardCheck, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HomeCard {
  to: string;
  title: string;
  description: string;
  icon: typeof Package;
}

const cards: HomeCard[] = [
  {
    to: '/labs/cycle-count',
    title: 'Cycle Count',
    description: 'Scan your shelf and reconcile it against the system — fix any differences in one tap.',
    icon: ClipboardList,
  },
  {
    to: '/my-inventory',
    title: 'My Inventory',
    description: "See everything currently assigned to you, with lot numbers and expiry dates.",
    icon: Package,
  },
  {
    to: '/usage',
    title: 'Record Usage',
    description: 'Log the implants you used so your stock stays accurate.',
    icon: ClipboardCheck,
  },
];

export default function DistributorHome() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">Welcome{user ? `, ${user.username}` : ''}</h2>
        <p className="mt-1 text-sm text-gray-500">What would you like to do?</p>
      </div>

      <div className="space-y-3">
        {cards.map((c) => (
          <button
            key={c.to}
            onClick={() => navigate(c.to)}
            className="flex w-full items-center gap-4 rounded-2xl bg-white p-5 text-left shadow-sm hover:bg-gray-50"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
              <c.icon size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-gray-900">{c.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{c.description}</p>
            </div>
            <ChevronRight size={20} className="shrink-0 text-gray-400" />
          </button>
        ))}
      </div>
    </div>
  );
}
