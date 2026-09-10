'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, LogOut, ChevronDown } from 'lucide-react';
import { NAV_SECTIONS } from '@/lib/navigation';
import { signOut } from '@/lib/auth/actions';
import { dictionaries } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/config';
import { LanguageToggle } from '@/components/nav/LanguageToggle';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';
import { cn } from '@/lib/utils';

export type AppShellUser = { email: string; fullName: string | null };

export function AppShell({
  user,
  permissions,
  locale = 'en',
  children,
}: {
  user: AppShellUser;
  permissions: string[];
  locale?: Locale;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const allowed = new Set(permissions);

  // Close the mobile drawer AFTER the route actually changes. Closing it inside
  // the link's onClick unmounts the <Link> in the same tick, which races with —
  // and often cancels — Next's client-side navigation (the tap would just shut
  // the drawer without navigating). Reacting to the committed pathname avoids
  // that race entirely.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  const dict = dictionaries[locale] ?? dictionaries.en;

  const sections = NAV_SECTIONS.map((s) => ({
    ...s,
    title: dict.sections[s.title] ?? s.title,
    items: s.items
      .filter((i) => !i.permission || allowed.has(i.permission))
      .map((i) => ({ ...i, label: dict.nav[i.href] ?? i.label })),
  })).filter((s) => s.items.length > 0);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-neutral-200 bg-white lg:flex">
        <Brand />
        <Nav sections={sections} onNavigate={() => {}} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-neutral-900/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-neutral-200 bg-white">
            <div className="flex items-center justify-between pr-2">
              <Brand />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Do not close on click — the pathname effect closes the drawer
                once navigation commits, so the link is never unmounted mid-nav. */}
            <Nav sections={sections} onNavigate={() => {}} />
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-neutral-200 bg-white/80 px-4 backdrop-blur">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="ms-auto" />
          <LanguageToggle locale={locale} />

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-neutral-100"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-700">
                {(user.fullName || user.email).charAt(0).toUpperCase()}
              </span>
              <span className="hidden max-w-[180px] truncate text-neutral-700 sm:inline">
                {user.fullName || user.email}
              </span>
              <ChevronDown className="h-4 w-4 text-neutral-400" />
            </button>

            {menuOpen ? (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
                  <div className="border-b border-neutral-100 px-3 py-2">
                    <p className="truncate text-sm font-medium text-neutral-800">
                      {user.fullName || 'Signed in'}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {user.email}
                    </p>
                  </div>
                  <form action={signOut}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100"
                    >
                      <LogOut className="h-4 w-4" />
                      {dict.common.signOut}
                    </button>
                  </form>
                </div>
              </>
            ) : null}
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <LocaleProvider locale={locale}>{children}</LocaleProvider>
        </main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex h-14 items-center gap-2 px-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Les Abeilles" className="h-9 w-9 shrink-0 object-contain" />
      <div className="leading-tight">
        <p className="text-sm font-bold text-neutral-900">Nahla Cake</p>
        <p className="text-[11px] text-neutral-400">Management Panel</p>
      </div>
    </div>
  );
}

function Nav({
  sections,
  onNavigate,
}: {
  sections: typeof NAV_SECTIONS;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {sections.map((section) => (
        <div key={section.title} className="mb-5">
          <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                      active
                        ? 'bg-amber-100 font-semibold text-amber-900 shadow-sm ring-1 ring-amber-200/60'
                        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
