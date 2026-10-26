import { database } from '@/lib/supabase';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (code) {
    const db = await database();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return Response.redirect(`${url.origin}/admin`,303);
  }
  return Response.redirect(`${url.origin}/login?error=oauth`,303);
}
