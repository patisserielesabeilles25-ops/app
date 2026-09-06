import Link from 'next/link';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import { getCustomStatuses } from '@/lib/statuses/queries';
import { CANONICAL_STATUSES } from '@/lib/statuses/constants';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CustomStatusForm } from '@/components/statuses/CustomStatusForm';
import { CustomStatusRow } from '@/components/statuses/CustomStatusRow';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = { title: 'Statuses — Nahla Cake Panel' };

export default async function StatusesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; error?: string }>;
}) {
  await requirePermission('settings.manage');
  const locale = await getLocale();
  const { msg, error } = await searchParams;
  const perms = await getMyPermissions();
  const canManage = perms.has('settings.manage');

  const custom = await getCustomStatuses();

  return (
    <>
      <PageHeader
        title={tr(locale, 'Statuses', 'الحالات')}
        description={tr(locale, 'Fixed pipeline statuses, plus your own custom statuses linked to them.', 'حالات المسار الثابتة، بالإضافة إلى حالاتك المخصصة المرتبطة بها.')}
      />

      {msg ? (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />{msg}
        </div>
      ) : null}
      {error ? (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-5 w-5" />{error}
        </div>
      ) : null}

      <Card className="max-w-3xl">
        <CardHeader
          title={tr(locale, 'Pipeline statuses', 'حالات المسار')}
          description={tr(locale, 'The 7 statuses below are built in. Add custom statuses under any of them.', 'الحالات السبع أدناه مدمجة. أضف حالات مخصصة تحت أي منها.')}
        />
        <CardBody className="space-y-5">
          {CANONICAL_STATUSES.map((s) => {
            const rows = custom.filter((c) => c.canonical === s.key);
            return (
              <div key={s.key} className="rounded-xl border border-neutral-100 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge tone={s.tone}>{s.label}</Badge>
                  <span className="text-[10px] uppercase tracking-wide text-neutral-300">{tr(locale, 'built-in', 'مدمج')}</span>
                </div>
                {s.hint ? <p className="mb-2 text-xs text-neutral-500">{s.hint}</p> : null}
                {s.links && s.links.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {s.links.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 hover:bg-neutral-200"
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
                {rows.length > 0 ? (
                  <ul className="divide-y divide-neutral-50">
                    {rows.map((c) => (
                      <CustomStatusRow key={c.id} status={c} />
                    ))}
                  </ul>
                ) : (
                  <p className="px-1 text-xs text-neutral-400">{tr(locale, 'No custom statuses linked yet.', 'لا توجد حالات مخصصة مرتبطة بعد.')}</p>
                )}
              </div>
            );
          })}

          {canManage ? (
            <div className="border-t border-neutral-100 pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
                {tr(locale, 'Add custom status', 'إضافة حالة مخصصة')}
              </p>
              <CustomStatusForm />
            </div>
          ) : null}
        </CardBody>
      </Card>
    </>
  );
}
