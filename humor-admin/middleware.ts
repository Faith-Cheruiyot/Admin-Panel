import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_URL, SUPABASE_KEY } from './lib/supabase-config';
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const db = createServerClient(SUPABASE_URL, SUPABASE_KEY, { cookies: {
    getAll: () => request.cookies.getAll(),
    setAll(values, cacheHeaders) {
      values.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      Object.entries(cacheHeaders || {}).forEach(([key, value]) => response.headers.set(key, value));
    },
  }});
  await db.auth.getUser();
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
}
