import { Outlet } from 'react-router-dom';
import { SectionNav } from '../../components/dashboard/DashboardBits';

const NGO_NAV = [
  { to: '/ngo', label: 'Overview', end: true },
  { to: '/ngo/tasks', label: 'Available tasks' },
  { to: '/ngo/work', label: 'My work' },
  { to: '/ngo/leaderboard', label: 'Leaderboard' },
];

export function NgoLayout() {
  return (
    <div>
      <SectionNav items={NGO_NAV} label="NGO workspace" />
      <Outlet />
    </div>
  );
}
