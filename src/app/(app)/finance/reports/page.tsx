import Link from 'next/link';
import {
  ArrowLeft, Cake, TrendingUp, Banknote, Wallet, Clock3, Receipt, ShoppingBag,
  Users, UserPlus, RotateCcw, CalendarClock, Truck, Sparkles, Trophy,
  type LucideIcon,
} from 'lucide-react';
import { requirePermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { getRange, getCustomRange, financeSummary, financeByCategory, type PeriodPreset } from '@/lib/finance/reports';
import { getOrderAnalytics } from '@/lib/finance/analytics';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { formatAmount } from '@/lib/utils';
import { tr } from '@/lib/i18n/t';
import { getLocale } from '@/lib/i18n/server';
import type { Locale } from '@/lib/i18n/config';

export const metadata = { title: 'Analytics — Nahla Cake Panel' };

const PRESETS: PeriodPreset[] = ['today', 'week', 'month', 'year'];

function presetLabel(locale: Locale, key: PeriodPreset): string {
  switch (key) {
    case 'today': return tr(locale, 'Today', 'اليوم');
    case 'week': return tr(locale, 'This week', 'هذا الأسبوع');
    case 'month': return tr(locale, 'This month', 'هذا الشهر');
    case 'year': return tr(locale, 'This year', 'هذه السنة');
  }
}

const pct = (v: number) => `${v.toFixed(0)}%`;
const DA = (v: number) => `${formatAmount(v)} DA`;

// ---- Accent palette -------------------------------------------------------
type Accent = 'emerald' | 'amber' | 'rose' | 'sky' | 'violet' | 'indigo' | 'neutral';
const ACCENT: Record<Accent, { chip: string; value: string; bar: string }> = {
  emerald: { chip: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-700', bar: '#10b981' },
  amber: { chip: 'bg-amber-100 text-amber-600', value: 'text-amber-700', bar: '#f59e0b' },
  rose: { chip: 'bg-rose-50 text-rose-600', value: 'text-rose-700', bar: '#f43f5e' },
  sky: { chip: 'bg-sky-50 text-sky-600', value: 'text-sky-700', bar: '#0ea5e9' },
  violet: { chip: 'bg-violet-50 text-violet-600', value: 'text-violet-700', bar: '#8b5cf6' },
  indigo: { chip: 'bg-indigo-50 text-indigo-600', value: 'text-indigo-700', bar: '#6366f1' },
  neutral: { chip: 'bg-neutral-100 text-neutral-600', value: 'text-neutral-900', bar: '#a3a3a3' },
};

function StatCard({ icon: Icon, label, value, sub, accent = 'neutral' }: {
  icon: LucideIcon; label: string; value: string; sub?: string; accent?: Accent;
}) {
  const c = ACCENT[accent];
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.chip}`}>
        <Icon className="h-5 w-5" />
      </span>
      <p className={`mt-3 text-2xl font-bold tracking-tight ${c.value}`}>{value}</p>
      <p className="text-sm font-medium text-neutral-600">{label}</p>
      {sub ? <p className="mt-0.5 text-xs text-neutral-400">{sub}</p> : null}
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, accent = 'neutral' }: {
  icon: LucideIcon; label: string; value: string; accent?: Accent;
}) {
  const c = ACCENT[accent];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3.5 py-3 shadow-sm">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.chip}`}>
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0">
        <p className={`text-lg font-bold leading-tight ${c.value}`}>{value}</p>
        <p className="truncate text-xs text-neutral-500">{label}</p>
      </div>
    </div>
  );
}

/** SVG donut with a centered total. Segments are {value, color, label}. */
function Donut({ segments, centerLabel, centerValue }: {
  segments: { value: number; color: string; label: string }[];
  centerLabel: string; centerValue: string;
}) {
  const size = 160, thickness = 22;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  // Precompute each arc's length + starting offset (no mutation during render).
  const arcs = segments.reduce<{ color: string; len: number; start: number }[]>((acc, s) => {
    const len = (s.value / total) * circ;
    const start = acc.length ? acc[acc.length - 1].start + acc[acc.length - 1].len : 0;
    acc.push({ color: s.color, len, start });
    return acc;
  }, []);
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f1f1" strokeWidth={thickness} />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {arcs.map((arc, i) => (
            <circle
              key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={arc.color} strokeWidth={thickness}
              strokeDasharray={`${arc.len} ${circ - arc.len}`} strokeDashoffset={-arc.start}
              strokeLinecap="butt"
            />
          ))}
        </g>
        <text x="50%" y="47%" textAnchor="middle" className="fill-neutral-900" style={{ fontSize: 26, fontWeight: 700 }}>{centerValue}</text>
        <text x="50%" y="62%" textAnchor="middle" className="fill-neutral-400" style={{ fontSize: 12 }}>{centerLabel}</text>
      </svg>
      <ul className="space-y-2 text-sm">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
            <span className="text-neutral-600">{s.label}</span>
            <span className="font-semibold text-neutral-800">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Vertical gradient bar chart. */
function BarChart({ data, color, format }: {
  data: { label: string; value: number }[]; color: string; format?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-44 items-end justify-between gap-2">
      {data.map((d) => (
        <div key={d.label} className="group flex flex-1 flex-col items-center gap-1.5">
          <span className="text-[10px] font-semibold text-neutral-400 opacity-0 transition group-hover:opacity-100">
            {format ? format(d.value) : d.value}
          </span>
          <div className="flex w-full flex-1 items-end rounded-md bg-neutral-50">
            <div
              className="w-full rounded-md transition-all"
              style={{
                height: `${Math.max((d.value / max) * 100, d.value > 0 ? 6 : 0)}%`,
                background: `linear-gradient(to top, ${color}, ${color}bb)`,
              }}
              title={format ? format(d.value) : String(d.value)}
            />
          </div>
          <span className="text-[11px] text-neutral-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Horizontal bar list. */
function HBars({ rows, color, format }: {
  rows: { label: string; value: number }[]; color: string; format?: (v: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={`${r.label}-${i}`}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="truncate text-neutral-700">{r.label}</span>
            <span className="ms-2 shrink-0 font-semibold text-neutral-800">{format ? format(r.value) : r.value}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_TONES = [
  'bg-amber-100 text-amber-700', 'bg-emerald-100 text-emerald-700', 'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700', 'bg-rose-100 text-rose-700',
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  await requirePermission('finance.reports.view');
  const locale = await getLocale();
  const sp = await searchParams;

  const isCustom = sp.period === 'custom' && sp.from && sp.to;
  const preset = (['today', 'week', 'month', 'year'].includes(sp.period ?? '') ? sp.period : 'month') as PeriodPreset;
  const range = isCustom ? getCustomRange(sp.from!, sp.to!) : getRange(preset);

  const supabase = await createClient();
  const [a, summary, categories] = await Promise.all([
    getOrderAnalytics(range),
    financeSummary(supabase, range),
    financeByCategory(supabase, range),
  ]);

  const net = a.revenue - summary.expense;
  const expenseRows = categories
    .filter((c) => c.expense > 0)
    .sort((x, y) => y.expense - x.expense)
    .slice(0, 6)
    .map((c) => ({ label: c.category_name, value: c.expense }));

  // Best revenue month for the insights panel.
  const best = a.revenueByMonth.reduce((m, x) => (x.revenue > m.revenue ? x : m), { label: '', revenue: 0 });

  // Auto insights (only meaningful ones).
  const insights: string[] = [];
  if (best.revenue > 0) insights.push(tr(locale, `Best month: ${best.label} with ${DA(best.revenue)}.`, `أفضل شهر: ${best.label} بـ ${DA(best.revenue)}.`));
  if (a.outstanding > 0) insights.push(tr(locale, `${DA(a.outstanding)} still to collect.`, `${DA(a.outstanding)} ما زالت مستحقة التحصيل.`));
  if (a.activeClients > 0) insights.push(tr(locale, `${pct(a.recurrentPct)} of active clients are returning customers.`, `${pct(a.recurrentPct)} من العملاء النشطين هم عملاء متكررون.`));
  if (a.returnRate > 0 || a.reportedRate > 0) insights.push(tr(locale, `${pct(a.returnRate)} returned · ${pct(a.reportedRate)} postponed.`, `${pct(a.returnRate)} مُرجعة · ${pct(a.reportedRate)} مؤجلة.`));
  if (insights.length === 0) insights.push(tr(locale, 'No activity in this period yet.', 'لا يوجد نشاط في هذه الفترة بعد.'));

  const useProducts = a.topProducts.length > 0;
  const productRows = useProducts
    ? a.topProducts.map((p) => ({ label: p.name, value: p.count }))
    : a.topSizes.map((s) => ({ label: `⌀ ${s.size} cm`, value: s.count }));

  return (
    <>
      <Link href="/finance" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800">
        <ArrowLeft className="h-4 w-4" />
        {tr(locale, 'Back to finance', 'العودة إلى المالية')}
      </Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title={tr(locale, 'Analytics', 'التحليلات')}
          description={tr(locale, 'Analyse your business performance by period.', 'حلّل أداء نشاطك حسب الفترة.')}
        />
        {/* Period selector */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
            {PRESETS.map((p) => {
              const active = !isCustom && preset === p;
              return (
                <Link
                  key={p}
                  href={`/finance/reports?period=${p}`}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${active ? 'bg-amber-400 text-neutral-900 shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'}`}
                >
                  {presetLabel(locale, p)}
                </Link>
              );
            })}
          </div>
          <form method="get" className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
            <input type="hidden" name="period" value="custom" />
            <input name="from" type="date" defaultValue={sp.from} className="rounded-lg px-2 py-1.5 text-sm outline-none" required />
            <span className="text-neutral-300">→</span>
            <input name="to" type="date" defaultValue={sp.to} className="rounded-lg px-2 py-1.5 text-sm outline-none" required />
            <button type="submit" className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${isCustom ? 'bg-amber-400 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-100'}`}>
              {tr(locale, 'Custom', 'مخصص')}
            </button>
          </form>
        </div>
      </div>

      {/* Insights */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400 text-neutral-900">
            <Sparkles className="h-4.5 w-4.5" />
          </span>
          <h2 className="text-sm font-semibold text-neutral-800">{tr(locale, 'Insights', 'رؤى')}</h2>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {insights.map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              {t}
            </li>
          ))}
        </ul>
      </div>

      {/* Primary KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatCard icon={TrendingUp} accent="emerald" label={tr(locale, 'Revenue', 'رقم الأعمال')} value={DA(a.revenue)} sub={`${a.totalOrders} ${tr(locale, 'orders', 'طلبات')}`} />
        <StatCard icon={Receipt} accent="rose" label={tr(locale, 'Expenses', 'المصاريف')} value={DA(summary.expense)} sub={`${summary.expense_count} ${tr(locale, 'entries', 'حركات')}`} />
        <StatCard icon={Banknote} accent={net >= 0 ? 'indigo' : 'rose'} label={tr(locale, 'Net (rev. − exp.)', 'الصافي (أعمال − مصاريف)')} value={DA(net)} sub={tr(locale, 'estimated margin', 'الهامش التقديري')} />
        <StatCard icon={ShoppingBag} accent="amber" label={tr(locale, 'Average order', 'متوسط الطلب')} value={DA(a.avgOrderValue)} sub={tr(locale, 'per order', 'لكل طلب')} />
        <StatCard icon={Wallet} accent="sky" label={tr(locale, 'Collected', 'محصّل')} value={DA(a.collected)} sub={tr(locale, 'already paid', 'مدفوع بالفعل')} />
        <StatCard icon={Clock3} accent="amber" label={tr(locale, 'To collect', 'مستحق التحصيل')} value={DA(a.outstanding)} sub={tr(locale, 'remaining due', 'المتبقي المستحق')} />
        <StatCard icon={Users} accent="violet" label={tr(locale, 'Active clients', 'العملاء النشطون')} value={String(a.activeClients)} sub={tr(locale, 'this period', 'هذه الفترة')} />
        <StatCard icon={UserPlus} accent="emerald" label={tr(locale, 'New clients', 'عملاء جدد')} value={String(a.newClients)} sub={tr(locale, 'first order', 'أول طلب')} />
      </div>

      {/* Secondary rate chips */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <MiniStat icon={Trophy} accent="emerald" label={tr(locale, 'Recurring clients', 'العملاء المتكررون')} value={pct(a.recurrentPct)} />
        <MiniStat icon={RotateCcw} accent={a.returnRate > 0 ? 'rose' : 'neutral'} label={tr(locale, 'Return rate', 'معدل الإرجاع')} value={pct(a.returnRate)} />
        <MiniStat icon={CalendarClock} accent={a.reportedRate > 0 ? 'amber' : 'neutral'} label={tr(locale, 'Postponed', 'مؤجلة')} value={pct(a.reportedRate)} />
        <MiniStat icon={Truck} accent="sky" label={tr(locale, 'Delivery / Pickup', 'توصيل / استلام')} value={`${a.delivery} / ${a.pickup}`} />
      </div>

      {/* Charts row 1 */}
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={tr(locale, 'Revenue trend (6 months)', 'تطور رقم الأعمال (6 أشهر)')} description={tr(locale, 'Booked revenue per month', 'رقم الأعمال المسجّل شهريًا')} />
          <CardBody>
            <BarChart data={a.revenueByMonth.map((m) => ({ label: m.label, value: m.revenue }))} color="#10b981" format={DA} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={tr(locale, 'Delivery vs pickup', 'التوصيل مقابل الاستلام')} />
          <CardBody>
            {a.totalOrders === 0 ? (
              <p className="text-sm text-neutral-400">{tr(locale, 'No orders in this period.', 'لا توجد طلبات في هذه الفترة.')}</p>
            ) : (
              <Donut
                centerValue={String(a.totalOrders)}
                centerLabel={tr(locale, 'orders', 'طلبات')}
                segments={[
                  { value: a.delivery, color: '#0ea5e9', label: tr(locale, 'Delivery', 'توصيل') },
                  { value: a.pickup, color: '#fbbf24', label: tr(locale, 'Pickup', 'استلام') },
                ]}
              />
            )}
          </CardBody>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={tr(locale, 'Busiest days', 'أكثر الأيام ازدحامًا')} description={tr(locale, 'Orders by delivery day', 'الطلبات حسب يوم التوصيل')} />
          <CardBody>
            <BarChart data={a.weekdays.map((w) => ({ label: w.label, value: w.count }))} color="#f59e0b" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={tr(locale, 'Expenses by category', 'المصاريف حسب الفئة')} description={tr(locale, 'Where the money went', 'أين صُرفت الأموال')} />
          <CardBody>
            {expenseRows.length === 0 ? (
              <p className="text-sm text-neutral-400">{tr(locale, 'No expenses in this period.', 'لا مصاريف في هذه الفترة.')}</p>
            ) : (
              <HBars rows={expenseRows} color="#f43f5e" format={DA} />
            )}
          </CardBody>
        </Card>
      </div>

      {/* Lists row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title={tr(locale, 'Top clients', 'أفضل العملاء')} description={tr(locale, 'By number of orders', 'حسب عدد الطلبات')} />
          <CardBody>
            {a.topClients.length === 0 ? (
              <p className="text-sm text-neutral-400">{tr(locale, 'No clients.', 'لا يوجد عملاء.')}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {a.topClients.map((c, i) => (
                  <li key={`${c.name}-${i}`} className="flex items-center gap-3 rounded-lg px-1 py-1">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${AVATAR_TONES[i % AVATAR_TONES.length]}`}>
                      {initials(c.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-neutral-700">{c.name}</span>
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-700">
                      {c.orders} {tr(locale, 'orders', 'طلب')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 border-t border-neutral-100 pt-2 text-xs text-neutral-400">
              {tr(locale, `${pct(a.recurrentAllTimePct)} of ${a.totalClients} clients ordered more than once.`, `${pct(a.recurrentAllTimePct)} من ${a.totalClients} عميلًا طلبوا أكثر من مرة.`)}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={tr(locale, 'Top products', 'أفضل المنتجات')}
            description={useProducts ? tr(locale, 'Most ordered products', 'المنتجات الأكثر طلبًا') : tr(locale, 'By size (orders without linked product)', 'حسب الحجم (طلبات بدون منتج مرتبط)')}
          />
          <CardBody>
            {productRows.length === 0 ? (
              <p className="text-sm text-neutral-400">{tr(locale, 'Nothing in this period.', 'لا شيء في هذه الفترة.')}</p>
            ) : (
              <HBars rows={productRows} color="#8b5cf6" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={tr(locale, 'Birthdays this month', 'أعياد الميلاد هذا الشهر')} description={tr(locale, 'Great for re-engaging clients', 'مثالي لإعادة التواصل مع العملاء')} />
          <CardBody>
            {a.birthdays.length === 0 ? (
              <p className="text-sm text-neutral-400">{tr(locale, 'No birthdays this month.', 'لا أعياد ميلاد هذا الشهر.')}</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {a.birthdays.map((b, i) => (
                  <li key={`${b.name}-${i}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-neutral-50">
                    <span className="inline-flex items-center gap-2 text-neutral-700"><Cake className="h-3.5 w-3.5 text-amber-400" />{b.name}</span>
                    <span className="font-medium text-neutral-800">{tr(locale, 'on', 'يوم')} {b.day}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
