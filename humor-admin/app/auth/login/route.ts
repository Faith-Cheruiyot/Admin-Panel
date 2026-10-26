import { database } from '@/lib/supabase';
export async function GET(request: Request) {
  const db = await database();
  const origin = new URL(request.url).origin;
  const { data, error } = await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}/auth/callback`, queryParams: { prompt: 'select_account' } } });
  if (error || !data.url) return Response.redirect(`${origin}/login?error=oauth`, 303);
  return new Response(null, { status: 303, headers: { Location: data.url, 'Cache-Control': 'no-store' } });
}
