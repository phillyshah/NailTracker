import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router';
import {
  Building2,
  ScanLine,
  Package,
  BarChart3,
  Users,
  LogOut,
  Menu,
  X,
  Images,
  UserCog,
  ArrowRightLeft,
  Boxes,
  BookOpen,
  Sparkles,
  ClipboardCheck,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { NotificationBell } from './NotificationBell';
import { WhatsNewModal } from './WhatsNewModal';
import { APP_VERSION } from '../version';
import { cn } from '../utils/cn';

const GUIDE_URL = 'https://github.com/phillyshah/NailTracker/raw/main/Nail_Tracker_User_Guide.docx';

// Four daily pillars on the bottom bar: stock in, stock out, browse, analyze.
const mainNavItems = [
  { to: '/receive', label: 'Receive', icon: Building2 },
  { to: '/usage', label: 'Usage', icon: ClipboardCheck },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
];

// Everything else, grouped so the More sheet stays scannable. Histories and
// analytics live under Reports — More holds actions and setup only.
const moreGroups = [
  {
    label: 'Tools',
    items: [
      { to: '/scan', label: 'Lookup', icon: ScanLine },
      { to: '/transfer', label: 'Transfer', icon: ArrowRightLeft },
      { to: '/batch', label: 'Batch Upload', icon: Images },
    ],
  },
  {
    label: 'Organize',
    items: [
      { to: '/banks', label: 'Banks', icon: Boxes },
      { to: '/distributors', label: 'Distributors', icon: Users },
    ],
  },
  {
    label: 'Admin',
    items: [{ to: '/users', label: 'User Management', icon: UserCog }],
  },
];

// Flat list for the desktop top nav.
const moreNavItems = moreGroups.flatMap((g) => g.items);

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  // Close More menu on any route change
  useEffect(() => {
    setShowMore(false);
  }, [location.pathname]);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Top bar — desktop */}
      <header className="hidden lg:flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-primary-700">Nail Tracker</h1>
            <button
              onClick={() => setShowWhatsNew(true)}
              className="rounded-full bg-primary-100 px-2.5 py-0.5 text-sm font-semibold text-primary-600 hover:bg-primary-200 transition-colors"
              title="What's New"
            >
              v{APP_VERSION}
            </button>
          </div>
          <nav className="flex gap-1">
            {[...mainNavItems, ...moreNavItems].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-lg px-4 py-2 text-base font-medium transition-colors',
                    isActive
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100',
                  )
                }
              >
                <item.icon size={20} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <a
            href={GUIDE_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            title="Download User Guide"
          >
            <BookOpen size={16} />
            Guide
          </a>
          <span className="text-sm text-gray-500">{user?.username}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="flex lg:hidden items-center justify-between border-b bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-primary-700">Nail Tracker</h1>
          <button
            onClick={() => setShowWhatsNew(true)}
            className="rounded-full bg-primary-100 px-2.5 py-0.5 text-sm font-bold text-primary-600"
            title="What's New"
          >
            v{APP_VERSION}
          </button>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <a
            href={GUIDE_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="User Guide"
          >
            <BookOpen size={20} />
          </a>
          <button
            onClick={handleLogout}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Log out"
          >
            <LogOut size={22} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 lg:px-10 lg:py-6 lg:pb-6">
        <Outlet />
      </main>

      {/* Bottom navigation — mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.06)] lg:hidden">
        <div className="flex justify-around">
          {mainNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors',
                  isActive ? 'text-primary-700' : 'text-gray-400',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute -top-0.5 left-3 right-3 h-[3px] rounded-full bg-primary-600" />
                  )}
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-xl transition-colors',
                      isActive ? 'bg-primary-100' : '',
                    )}
                  >
                    <item.icon size={22} />
                  </div>
                  <span className={cn(isActive ? 'font-bold' : '')}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
          {/* More button */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors',
              showMore ? 'text-primary-700' : 'text-gray-400',
            )}
          >
            {showMore && (
              <div className="absolute -top-0.5 left-3 right-3 h-[3px] rounded-full bg-primary-600" />
            )}
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl transition-colors',
                showMore ? 'bg-primary-100' : '',
              )}
            >
              <Menu size={22} />
            </div>
            <span className={cn(showMore ? 'font-bold' : '')}>More</span>
          </button>
        </div>
      </nav>

      {/* More menu overlay — mobile */}
      {showMore && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white p-4 pb-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">More</h3>
              <button
                onClick={() => setShowMore(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              {moreGroups.map((group) => (
                <div key={group.label}>
                  <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setShowMore(false)}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium transition-colors',
                            isActive
                              ? 'bg-primary-100 text-primary-700'
                              : 'text-gray-700 hover:bg-gray-100',
                          )
                        }
                      >
                        <item.icon size={22} />
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-2 space-y-1">
              <a
                href={GUIDE_URL}
                target="_blank"
                rel="noreferrer"
                onClick={() => setShowMore(false)}
                className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium text-gray-700 hover:bg-gray-100"
              >
                <BookOpen size={22} />
                User Guide
              </a>
              <button
                onClick={() => { setShowMore(false); setShowWhatsNew(true); }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium text-gray-700 hover:bg-gray-100"
              >
                <Sparkles size={22} />
                What's New
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <WhatsNewModal open={showWhatsNew} onClose={() => setShowWhatsNew(false)} />
    </div>
  );
}
