import {
  BarChart3, Building2, CalendarClock, ClipboardCheck, LayoutDashboard, Landmark, MapPin, Package, Printer,
  ScanLine, Settings, Tags, UserCog, Users, Wrench,
} from 'lucide-react';
import ScanIcon from './ScanIcon';

/** Each item's key is also its permission module: shown when the role has `<key>.view` (see Users → Roles & permissions).
 *  always: true = every signed-in user (Settings holds the personal profile / password). */
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
    { key: 'users', href: '/users', icon: UserCog },
    { key: 'settings', href: '/settings', icon: Settings, always: true },
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

/** May this user see the nav item? */
export const canSee = (can, it) => it.always || can(`${it.key}.view`);

/** Permission needed to open a page, or null when anyone signed in may */
export function requiredPerm(pathname) {
  if (pathname === '/assets/new') return 'assets.add';
  if (/^\/assets\/\d+\/edit/.test(pathname)) return 'assets.edit';
  for (const g of NAV) for (const it of g.items) {
    if (isActive(pathname, it.href)) return it.always ? null : `${it.key}.view`;
  }
  return null;
}

/** First page this user may open (used when the dashboard is hidden for their role) */
export function firstAllowed(can) {
  for (const g of NAV) for (const it of g.items) if (canSee(can, it)) return it.href;
  return '/settings';
}
