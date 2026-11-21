import {
  BarChart3, Building2, CalendarClock, ClipboardCheck, LayoutDashboard, Landmark, MapPin, Package, Printer,
  ScanLine, Settings, Tags, UserCog, Users, Wrench,
} from 'lucide-react';
import ScanIcon from './ScanIcon';

/** roles: undefined = everyone, 'manage' = admin+manager, 'admin' = admin only */
export const NAV = [
  { items: [
    { key: 'dashboard', href: '/', icon: LayoutDashboard },
    { key: 'scan', href: '/scan', icon: ScanIcon },
  ] },
  { section: 'assets', items: [
    { key: 'assets', href: '/assets', icon: Package },
    { key: 'schedule', href: '/schedule', icon: CalendarClock },
    { key: 'print', href: '/print', icon: Printer },
  ] },
  { section: 'operations', items: [
    { key: 'inspections', href: '/inspections', icon: ClipboardCheck },
    { key: 'repairs', href: '/repairs', icon: Wrench },
  ] },
  { section: 'master', items: [
    { key: 'locations', href: '/master/locations', icon: MapPin },
    { key: 'categories', href: '/master/categories', icon: Tags },
    { key: 'departments', href: '/master/departments', icon: Building2 },
    { key: 'custodians', href: '/master/custodians', icon: Users },
    { key: 'companies', href: '/master/companies', icon: Landmark },
  ] },
  { section: 'system', items: [
    { key: 'reports', href: '/reports', icon: BarChart3 },
    { key: 'users', href: '/users', icon: UserCog, role: 'admin' },
    { key: 'settings', href: '/settings', icon: Settings },
  ] },
];

export const isActive = (pathname, href) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'));

export function pageTitleKey(pathname) {
  if (pathname === '/assets/new') return 'asset_new';
  if (/^\/assets\/\d+\/edit/.test(pathname)) return 'asset_edit';
  if (/^\/assets\/\d+/.test(pathname)) return 'asset_detail';
  for (const g of NAV) for (const it of g.items) if (isActive(pathname, it.href)) return it.key;
  return 'dashboard';
}
