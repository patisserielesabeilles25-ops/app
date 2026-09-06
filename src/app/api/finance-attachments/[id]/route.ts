import { NextResponse, type NextRequest } from 'next/server';
import { hasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Returns a short-lived signed URL redirect for a finance attachment.
 * Gated by finance.attachments.view at the app layer AND by RLS on the row.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await hasPermission('finance.attachments.view'))) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();
  // `id` is the transaction id; return its (first) attachment.
  const { data: att } = await supabase
    .from('financial_attachments')
    .select('bucket, object_path')
    .eq('transaction_id', id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!att) return new NextResponse('Not found', { status: 404 });

  const service = createServiceClient();
  const { data } = await service.storage
    .from(att.bucket)
    .createSignedUrl(att.object_path, 300);

  if (!data?.signedUrl) return new NextResponse('Error', { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
