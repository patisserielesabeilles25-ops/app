import { Lock } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { PasswordForm } from '@/components/settings/PasswordForm';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = { title: 'Paramètres — Nahla Cake Panel' };

export default async function SettingsPage() {
  await requireUser();
  const locale = await getLocale();

  return (
    <>
      <PageHeader
        title={tr(locale, 'Settings', 'الإعدادات')}
        description={tr(locale, 'Configure your account and organization.', 'إعداد حسابك ومؤسستك.')}
      />

      <Card className="max-w-2xl">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Lock className="h-4 w-4 text-neutral-500" />
              {tr(locale, 'Change password', 'تغيير كلمة المرور')}
            </span>
          }
        />
        <CardBody>
          <PasswordForm />
        </CardBody>
      </Card>
    </>
  );
}
