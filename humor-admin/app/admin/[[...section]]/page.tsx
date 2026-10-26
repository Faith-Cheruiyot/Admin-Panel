import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { snapshot } from '@/lib/data';
import AdminApp from '@/components/admin-app';
export const dynamic = 'force-dynamic';
export default async function AdminPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { db, user } = await requireAdmin();
  const { section } = await params;
  const view = section?.[0] || 'overview';
  if ((section?.length || 0) > 1 || !['overview','media','profiles','ratings','access'].includes(view)) notFound();
  const initial = await snapshot(db);
  const { data: profile } = await db.from('profiles').select('first_name,last_name').eq('user_id', user.id).single();
  return <AdminApp view={view} initial={initial} account={{ name: [profile?.first_name,profile?.last_name].filter(Boolean).join(' ') || 'Administrator', email: user.email || '' }} />;
}
