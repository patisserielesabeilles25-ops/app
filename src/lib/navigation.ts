import {
  LayoutDashboard,
  Store,
  ClipboardList,
  CalendarDays,
  Contact,
  Package,
  Wallet,
  Tags,
  BarChart3,
  Users,
  ShieldCheck,
  ListChecks,
  Settings,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from '@/lib/auth/permissions';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Permission required to see AND access this route. Omit for routes any
   *  signed-in user may reach (e.g. personal settings). */
  permission?: Permission;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

/**
 * Single source of truth for navigation. Visibility is filtered by permission
 * (cosmetic); every target route independently enforces the same permission
 * server-side.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { href: '/orders', label: 'Orders', icon: ClipboardList, permission: 'orders.view' },
      { href: '/clients', label: 'Clients', icon: Contact, permission: 'orders.view' },
      { href: '/calendar', label: 'Calendar', icon: CalendarDays, permission: 'calendar.view' },
      { href: '/products', label: 'Products', icon: Package, permission: 'products.view' },
      { href: '/whatsapp', label: 'WhatsApp', icon: MessageCircle, permission: 'whatsapp.view' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { href: '/finance', label: 'Cash Register', icon: Wallet, permission: 'finance.view' },
      { href: '/finance/reports', label: 'Analytics', icon: BarChart3, permission: 'finance.reports.view' },
      { href: '/finance/magasin', label: 'Magasin', icon: Store, permission: 'magasin.view' },
      { href: '/finance/categories', label: 'Categories', icon: Tags, permission: 'finance.categories.manage' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { href: '/users', label: 'Users', icon: Users, permission: 'users.view' },
      { href: '/roles', label: 'Roles', icon: ShieldCheck, permission: 'roles.view' },
      { href: '/statuses', label: 'Statuses', icon: ListChecks, permission: 'settings.manage' },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];
