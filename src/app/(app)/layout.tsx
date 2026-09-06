import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { getMyPermissions } from '@/lib/auth/permissions';
import { getLocale } from '@/lib/i18n/server';
import { AppShell } from '@/components/nav/AppShell';
import { OrdersRealtime } from '@/components/realtime/OrdersRealtime';

// Every authenticated route is per-user and reads cookies — never prerender.
export const dynamic = 'force-dynamic';

/**
 * Layout for all authenticated app routes. Enforces authentication server-side
 * (defense in depth alongside the proxy gate) and renders the navigation shell
 * filtered to the user's permissions. Page-level guards still enforce access.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const permissions = [...(await getMyPermissions())];
  const locale = await getLocale();

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  return (
    <AppShell
      user={{ email: user.email ?? '', fullName: profile?.full_name ?? null }}
      permissions={permissions}
      locale={locale}
    >
      <OrdersRealtime />
      {children}
    </AppShell>
  );
}
