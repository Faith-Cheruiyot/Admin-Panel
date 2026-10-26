import { database } from '@/lib/supabase';
import { assertSameOrigin, apiError } from '@/lib/auth';
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const db = await database();
    await db.auth.signOut({ scope: 'local' });
    return Response.redirect(`${new URL(request.url).origin}/login`,303);
  } catch (error) { return apiError(error); }
}
