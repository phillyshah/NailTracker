import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router';
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';

const mainNavItems = [
  { to: '/receive', label: 'Receive', icon: Building2 },
  { to: '/scan', label: 'Scan', icon: ScanLine },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
];

const moreNavItems = [
  { to: '/distributors', label: 'Distributors', icon: Users },
  { to: '/batch', label: 'Batch Upload', icon: Images },
  { to: '/users', label: 'User Management', icon: UserCog },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Top bar — desktop */}
      <header className="hidden lg:flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-8">
          <h1 className="text-xl font-bold text-primary-700">Summa Inventory</h1>
          <nav className="flex gap-1">
            {[...mainNavItems, ...moreNavItems].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-lg px-4 py-2 text-base font-medium transition-colors',
                    isActive
                      ? 'bg-primary-100 text-primary-700'
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
        <div className="flex items-center gap-4">
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
        <h1 className="text-lg font-bold text-primary-700">Summa Inventory</h1>
        <button
          onClick={handleLogout}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          aria-label="Log out"
        >
          <LogOut size={22} />
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 lg:px-8 lg:py-6 lg:pb-6">
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
                  'flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors',
                  isActive ? 'text-primary-600' : 'text-gray-400',
                )
              }
            >
              <item.icon size={24} />
              {item.label}
            </NavLink>
          ))}
          {/* More button */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors',
              showMore ? 'text-primary-600' : 'text-gray-400',
            )}
          >
            <Menu size={24} />
            More
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
            <div className="space-y-1">
              {moreNavItems.map((item) => (
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
        </div>
      )}
    </div>
  );
}
