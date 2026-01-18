import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import {
  Home,
  Users,
  Bike,
  Calendar,
  FileText,
  Bot,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import { clsx } from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Members', href: '/members', icon: Users },
  { name: 'Rides', href: '/rides', icon: Bike },
  { name: 'Meetings', href: '/meetings', icon: Calendar },
  { name: 'Minutes', href: '/minutes', icon: FileText },
  { name: 'AI Assistant', href: '/ai', icon: Bot },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 bg-hog-black-900 border-r border-hog-black-800 transform transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-hog-black-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-hog-orange-500 rounded-lg flex items-center justify-center">
                <Bike className="w-6 h-6 text-white" />
              </div>
              <span className="font-display font-bold text-lg">HOG Chapter</span>
            </div>
            <button
              className="lg:hidden text-hog-black-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-hog-orange-500/10 text-hog-orange-500'
                      : 'text-hog-black-300 hover:text-white hover:bg-hog-black-800'
                  )
                }
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </NavLink>
            ))}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-hog-black-800">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-hog-orange-500/10 text-hog-orange-500'
                    : 'text-hog-black-300 hover:text-white hover:bg-hog-black-800'
                )
              }
              onClick={() => setSidebarOpen(false)}
            >
              <Settings className="w-5 h-5" />
              Settings
            </NavLink>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-hog-black-900 border-b border-hog-black-800 flex items-center justify-between px-4 lg:px-6">
          <button
            className="lg:hidden text-hog-black-400 hover:text-white"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* User menu */}
          <div className="relative ml-auto">
            <button
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-hog-black-800 transition-colors"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
            >
              <div className="w-8 h-8 rounded-full bg-hog-orange-500 flex items-center justify-center text-white font-medium">
                {user?.member?.firstName?.[0] || user?.email?.[0]?.toUpperCase()}
              </div>
              <span className="hidden sm:block text-sm font-medium">
                {user?.member?.firstName || user?.email}
              </span>
              <ChevronDown className="w-4 h-4 text-hog-black-400" />
            </button>

            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-hog-black-800 rounded-lg shadow-lg border border-hog-black-700 py-1 z-20">
                  <div className="px-4 py-2 border-b border-hog-black-700">
                    <p className="text-sm font-medium">{user?.member?.firstName} {user?.member?.lastName}</p>
                    <p className="text-xs text-hog-black-400">{user?.email}</p>
                    <p className="text-xs text-hog-orange-500 capitalize mt-1">{user?.role}</p>
                  </div>
                  <button
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-hog-black-300 hover:text-white hover:bg-hog-black-700"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
