import { NavLink, useLocation } from 'react-router-dom';
import {
  BookOpen, ChartNoAxesColumnIncreasing, History, LayoutDashboard,
  ListChecks, Shield, Trophy, Zap,
} from 'lucide-react';
import { usePickemAdmin } from '@/hooks/usePickem';
import { cn } from '@/lib/utils';

const primaryItems = [
  { to: '/nfl', label: 'Game Center', icon: LayoutDashboard, exact: true },
  { to: '/pickem', label: "Pick'em", icon: ListChecks, exact: true },
  { to: '/nfl/crazy-chain', label: 'Crazy Chain', icon: Zap, exact: true },
  { to: '/pickem/standings', label: 'Standings', icon: Trophy, exact: false },
  { to: '/pickem/history', label: 'History', icon: History, exact: false },
  { to: '/pickem/rules', label: 'Playbook', icon: BookOpen, exact: false },
] as const;

export function PickemCommandNav() {
  const { pathname } = useLocation();
  const { isAdmin } = usePickemAdmin();
  const isChain = pathname.startsWith('/nfl/crazy-chain') || pathname.startsWith('/nfl/admin/crazy-chain');

  return (
    <nav className="nfl-command-nav" aria-label="NFL Game Center">
      <div className="nfl-command-nav-track">
        {primaryItems.map(({ to, label, icon: Icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) => cn('nfl-command-nav-link', isActive && 'is-active')}
          >
            <Icon aria-hidden />
            <span>{label}</span>
          </NavLink>
        ))}
        {isChain && (
          <NavLink
            to="/nfl/crazy-chain/leaderboard"
            className={({ isActive }) => cn('nfl-command-nav-link', isActive && 'is-active')}
          >
            <ChartNoAxesColumnIncreasing aria-hidden />
            <span>Chain leaders</span>
          </NavLink>
        )}
        {isAdmin && (
          <NavLink
            to={isChain ? '/nfl/admin/crazy-chain' : '/pickem/admin'}
            className={({ isActive }) => cn('nfl-command-nav-link nfl-command-nav-admin', isActive && 'is-active')}
          >
            <Shield aria-hidden />
            <span>Controls</span>
          </NavLink>
        )}
      </div>
    </nav>
  );
}