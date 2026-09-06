import Link from 'next/link';
import { Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import { getRoles } from '@/lib/admin/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/Button';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = { title: 'Roles — Nahla Cake Panel' };

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; error?: string }>;
}) {
  await requirePermission('roles.view');
  const locale = await getLocale();
  const { msg, error } = await searchParams;
  const perms = await getMyPermissions();
  const canCreate = perms.has('roles.create');
  const canEdit = perms.has('roles.edit');
  const roles = await getRoles();

  return (
    <>
      <PageHeader
        title={tr(locale, 'Roles', 'الأدوار')}
        description={tr(locale, 'Define roles and the permissions they grant.', 'تعريف الأدوار والصلاحيات التي تمنحها.')}
        action={canCreate ? <LinkButton href="/roles/new"><Plus className="h-4 w-4" />{tr(locale, 'New role', 'دور جديد')}</LinkButton> : undefined}
      />

      {msg ? <div className="mb-6 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="h-5 w-5" />{msg}</div> : null}
      {error ? <div className="mb-6 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700"><AlertTriangle className="h-5 w-5" />{error}</div> : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-semibold">{tr(locale, 'Role', 'الدور')}</th>
                <th className="px-4 py-3 font-semibold">{tr(locale, 'Key', 'المفتاح')}</th>
                <th className="px-4 py-3 font-semibold">{tr(locale, 'Permissions', 'الصلاحيات')}</th>
                <th className="px-4 py-3 font-semibold">{tr(locale, 'Type', 'النوع')}</th>
                {canEdit ? <th className="px-4 py-3" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {roles.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-800">{r.name}</div>
                    {r.description ? <div className="text-xs text-neutral-400">{r.description}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{r.key}</td>
                  <td className="px-4 py-3 text-neutral-600">{r.permissionCount}</td>
                  <td className="px-4 py-3">
                    <Badge tone={r.is_system ? 'violet' : 'neutral'}>{r.is_system ? tr(locale, 'System', 'نظام') : tr(locale, 'Custom', 'مخصص')}</Badge>
                  </td>
                  {canEdit ? (
                    <td className="px-4 py-3 text-right">
                      <Link href={`/roles/${r.id}`} className="text-sm text-amber-600 hover:underline">{tr(locale, 'Edit', 'تعديل')}</Link>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
