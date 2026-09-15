import Link from 'next/link';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { requirePermission } from '@/lib/auth/permissions';
import { CANONICAL_STATUSES } from '@/lib/statuses/constants';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
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

  return (
    <>
      <PageHeader
        title={tr(locale, 'Statuses', 'الحالات')}
        description={tr(locale, 'The fixed pipeline statuses an order moves through.', 'حالات المسار الثابتة التي يمر بها الطلب.')}
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
          description={tr(locale, 'The 7 statuses below are built in.', 'الحالات السبع أدناه مدمجة.')}
        />
        <CardBody className="space-y-5">
          {CANONICAL_STATUSES.map((s) => {
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
              </div>
            );
          })}
        </CardBody>
      </Card>
    </>
  );
}
