import { adminSession, assertSameOrigin, apiError, AccessError } from '@/lib/auth';
import { signImages, snapshot } from '@/lib/data';
import { pagination, validateMedia, imageFormat } from '@/lib/validation.mjs';
export async function GET(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  try {
    const { db } = await adminSession();
    const { resource } = await params;
    const q = new URL(request.url).searchParams;
    let data;
    if (resource === 'dashboard') {
      const days = Number(q.get('days') || 30);
      if (![7,30,90].includes(days)) throw new AccessError(400,'Choose a valid date range.');
      data = await snapshot(db,days);
    } else if (resource === 'media' || resource === 'ratings') {
      let filters;
      try { filters = pagination(q,resource === 'media' ? 12 : 20); } catch (e) { throw new AccessError(400,(e as Error).message); }
      const filter = q.get('filter') || 'all';
      if (!(resource === 'media' ? ['all','caption','photo'] : ['all','up','down']).includes(filter)) throw new AccessError(400,'Invalid filter.');
      const result = await db.rpc(resource === 'media' ? 'admin_media_list' : 'admin_vote_list', { search_term:filters.search, [resource === 'media' ? 'media_kind' : 'vote_kind']:filter, page_number:filters.page });
      if (result.error) throw result.error;
      data = result.data;
      if (resource === 'media') data.items = await signImages(db,data.items);
    } else if (resource === 'profiles') {
      let filters;
      try { filters = pagination(q,20); } catch (e) { throw new AccessError(400,(e as Error).message); }
      let query = db.from('profiles').select('id,user_id,first_name,last_name,created_at,avatar_path,is_superadmin',{ count:'exact' });
      if (filters.search) {
        const term = filters.search.replace(/[%_,().]/g,'');
        query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
      }
      const result = await query.order('created_at',{ascending:false}).range(filters.start,filters.end);
      if (result.error) throw result.error;
      data = { items:result.data,total:result.count };
    } else throw new AccessError(404,'Page not found.');
    return Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  try {
    assertSameOrigin(request);
    const { db, user } = await adminSession();
    const { resource } = await params;
    if (resource === 'upload') {
      if (Number(request.headers.get('content-length')) > 6*1024*1024) throw new AccessError(413,'Images must be 5 MB or smaller.');
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File) || file.size === 0 || file.size > 5*1024*1024) throw new AccessError(400,'Choose an image up to 5 MB.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const format = imageFormat(bytes);
      if (!format) throw new AccessError(400,'Only JPEG, PNG, and WebP images are supported.');
      const path = `${user.id}/${crypto.randomUUID()}.${format.ext}`;
      const { error } = await db.storage.from('caption-memes').upload(path,bytes,{contentType:format.mime,upsert:false});
      if (error) throw error;
      return Response.json({path},{status:201,headers:{'Cache-Control':'no-store'}});
    }
    if (resource !== 'media') throw new AccessError(404,'Page not found.');
    const input: any = await request.json();
    let record;
    try { record = validateMedia(input,user.id,true); } catch (e) { throw new AccessError(400,(e as Error).message); }
    const { data,error } = await db.from(input.kind === 'photo' ? 'photo_generations' : 'caption_generations').insert(record).select('id').single();
    if (error) {
      if (input.kind === 'photo') await db.storage.from('caption-memes').remove([input.image_path]);
      throw error;
    }
    return Response.json(data,{status:201,headers:{'Cache-Control':'no-store'}});
  } catch (error) { return apiError(error); }
}
