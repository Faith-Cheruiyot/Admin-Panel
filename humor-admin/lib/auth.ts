import { redirect } from 'next/navigation';
import { database } from './supabase';
export class AccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function adminSession() {
  const db = await database();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new AccessError(401, 'Please sign in with Google.');
  if (user.app_metadata.provider !== 'google') throw new AccessError(403, 'A Google sign-in is required.');
  const access = await db.rpc('admin_access');
  if (access.error || access.data !== true) throw new AccessError(403, 'This account does not have superadmin access.');
  return { db, user };
}
export async function requireAdmin() {
  try { return await adminSession(); }
  catch (error) {
    if (error instanceof AccessError) redirect(error.status === 401 ? '/login' : '/login?error=access');
    throw error;
  }
}
export function assertSameOrigin(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new AccessError(403, 'Request origin is not allowed.');
}
export function apiError(error: unknown) {
  if (error instanceof AccessError) return Response.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
  console.error('Admin request failed', error instanceof Error ? error.message : 'Database error');
  return Response.json({ error: 'The request could not be completed. Please try again.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
}
