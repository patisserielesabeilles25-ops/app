import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth/session';
import { getMyPermissions, landingPathFor } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getUser();
  if (!user) redirect('/login');
  const perms = await getMyPermissions();
  redirect(landingPathFor(perms));
}
