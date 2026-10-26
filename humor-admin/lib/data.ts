import type { SupabaseClient } from '@supabase/supabase-js';
export async function signImages(db: SupabaseClient, items: any[]) {
  const paths = items.filter(item => item.image_path).map(item => item.image_path as string);
  if (!paths.length) return items;
  const { data, error } = await db.storage.from('caption-memes').createSignedUrls(paths, 3600);
  if (error) throw error;
  const urls = new Map(data?.map(item => [item.path, item.signedUrl]));
  return items.map(item => ({ ...item, imageUrl: urls.get(item.image_path) || null }));
}
export async function snapshot(db: SupabaseClient, days = 30) {
  const { data, error } = await db.rpc('admin_snapshot', { days });
  if (error) throw error;
  data.leaderboard = await signImages(db, data.leaderboard);
  return data;
}
