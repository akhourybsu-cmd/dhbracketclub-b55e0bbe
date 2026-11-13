import { NavLink, useLocation } from 'react-router-dom';
import { LayoutGrid, Radio, Swords } from 'lucide-react';

/** Shared entrances; each format keeps its own room discovery and setup. */
export function DraftFormatSelector() {
  const { pathname } = useLocation();
  return <nav className="da-format-selector" aria-label="Draft experiences">
    {[
      { to: '/drafts', label: 'Classic', icon: Swords },
      { to: '/drafts/lineup', label: 'Lineup', icon: LayoutGrid },
      { to: '/drafts/live', label: 'LIVE', icon: Radio },
    ].map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end
      aria-current={pathname === to ? 'page' : undefined}
      className={pathname === to ? 'is-selected' : ''}>
      <Icon size={17} aria-hidden="true" /><span>{label}</span>
    </NavLink>)}
  </nav>;
}
