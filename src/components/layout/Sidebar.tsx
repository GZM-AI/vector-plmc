import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Box,
  GitBranch,
  Factory,
  CalendarClock,
  Search,
  LogOut,
  Crosshair,
  Bookmark,
} from 'lucide-react';

interface SidebarProps {
  user?: {
    username?: string;
    userId?: string;
    signInDetails?: { loginId?: string };
  };
  signOut?: () => void;
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/system-architecture', label: 'System Architecture', icon: Crosshair },
  { path: '/system-registry', label: 'System Registry', icon: Box },
  { path: '/baselines', label: 'Baselines', icon: Bookmark },
  { path: '/planning', label: 'Planning & Cost', icon: CalendarClock },
  { path: '/suppliers', label: 'Suppliers', icon: Factory },
  { path: '/changes', label: 'Change Control', icon: GitBranch },
  { path: '/research', label: 'Deep Research', icon: Search },
];

const Sidebar: React.FC<SidebarProps> = ({ user, signOut }) => {
  const location = useLocation();

  const displayName =
    user?.signInDetails?.loginId ||
    user?.username ||
    user?.userId ||
    'User';

  return (
    <div className="w-72 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full shrink-0">
      <div className="p-6 border-b border-zinc-800">
        <div className="flex flex-col items-center text-center mb-5">
          <img
            src="/images/AWS LOGO v2b - Presentations small.png"
            alt="AWS Logo"
            className="w-56 h-auto mb-4"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <p className="text-xs text-zinc-400 tracking-widest">
            ADVANCED WEAPONS SYSTEMS
          </p>
        </div>

        <h2 className="text-5xl font-bold text-blue-400 text-center w-full leading-tight">
          Vector
        </h2>
        <p className="text-sm text-zinc-300 text-center mt-2 tracking-wide leading-snug px-1">
          Product Lifecycle Management
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all ' +
                (isActive
                  ? 'bg-blue-600 text-white font-medium'
                  : 'hover:bg-zinc-800 text-zinc-400 hover:text-white')
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-zinc-500 truncate">Logged in as</p>
            <p className="text-sm text-zinc-300 truncate" title={displayName}>
              {displayName}
            </p>
          </div>
          {signOut && (
            <button
              type="button"
              onClick={() => signOut()}
              className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-800 transition shrink-0"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;