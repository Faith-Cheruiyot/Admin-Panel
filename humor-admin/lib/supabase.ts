import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_URL, SUPABASE_KEY } from './supabase-config';
export async function database() {
  const jar = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); }
        catch { /* Middleware persists refreshed cookies for server components. */ }
      },
    },
    global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) },
  });
}
