import { adminSession, assertSameOrigin, apiError, AccessError } from '@/lib/auth';
import { validateMedia, uuid } from '@/lib/validation.mjs';
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { db,user } = await adminSession();
    const { id } = await params;
    if (!uuid(id)) throw new AccessError(400,'Invalid media ID.');
    const input: any = await request.json();
    let record;
    try { record = validateMedia(input,user.id); } catch (e) { throw new AccessError(400,(e as Error).message); }
    const { data,error } = await db.from(input.kind==='photo'?'photo_generations':'caption_generations').update(record).eq('id',id).select('id').maybeSingle();
    if(error) throw error;
    if(!data) throw new AccessError(404,'This media no longer exists.');
    return Response.json(data,{headers:{'Cache-Control':'no-store'}});
  } catch(error) { return apiError(error); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { db } = await adminSession();
    const { id } = await params;
    const kind = new URL(request.url).searchParams.get('kind');
    if(!uuid(id) || !['photo','caption'].includes(kind || '')) throw new AccessError(400,'Invalid media.');
    const table=kind==='photo'?'photo_generations':'caption_generations';
    const { data:existing,error:readError }=await db.from(table).select(kind==='photo'?'id,image_path':'id').eq('id',id).maybeSingle();
    if(readError) throw readError;
    if(!existing) throw new AccessError(404,'This media no longer exists.');
    const {data,error}=await db.from(table).delete().eq('id',id).select('id').maybeSingle();
    if(error) throw error;
    if(!data) throw new AccessError(404,'This media no longer exists.');
    let warning;
    if(kind==='photo') {
      const cleanup=await db.storage.from('caption-memes').remove([(existing as unknown as {image_path:string}).image_path]);
      if(cleanup.error) warning='Media deleted. Its stored image could not be removed; an administrator should clean up the unused file.';
    }
    return Response.json({deleted:true,warning},{headers:{'Cache-Control':'no-store'}});
  } catch(error) { return apiError(error); }
}
