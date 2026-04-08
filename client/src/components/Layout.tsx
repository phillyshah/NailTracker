import { Outlet, NavLink, useNavigate } from 'react-router';
import { ScanLine, Package, BarChart3, Users, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';

const navItems = [
  { to: '/scan', label: 'Scan', icon: ScanLine },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/distributors', label: 'Distributors', icon: Users },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
            {navItems.map((item) => (
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
          {navItems.map((item) => (
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
        </div>
      </nav>
    </div>
  );
}
