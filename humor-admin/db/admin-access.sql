-- Admin access is additive: existing public Humor Project feeds keep their policies.
alter table public.profiles add column if not exists is_superadmin boolean not null default false;

create schema if not exists humor_private;
revoke all on schema humor_private from public, anon;
grant usage on schema humor_private to authenticated;

create or replace function humor_private.is_superadmin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null
    and coalesce(auth.jwt()->'app_metadata'->>'provider' = 'google', false)
    and exists (select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a where a->>'method' = 'oauth')
    and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_superadmin)
    and exists (select 1 from auth.sessions s where s.id::text = auth.jwt()->>'session_id' and s.user_id = auth.uid());
$$;
revoke all on function humor_private.is_superadmin() from public, anon;
grant execute on function humor_private.is_superadmin() to authenticated;

create or replace function public.admin_access()
returns boolean language sql stable security invoker set search_path = ''
as $$ select humor_private.is_superadmin(); $$;
revoke all on function public.admin_access() from public, anon;
grant execute on function public.admin_access() to authenticated;

create or replace function humor_private.protect_superadmin()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if current_user not in ('postgres','supabase_admin','service_role') then
    if (tg_op = 'INSERT' and new.is_superadmin)
      or (tg_op = 'UPDATE' and new.is_superadmin is distinct from old.is_superadmin) then
      raise exception 'Superadmin roles can only be assigned through trusted database administration.' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function humor_private.protect_superadmin() from public, anon, authenticated;
create trigger protect_superadmin_role before insert or update on public.profiles
for each row execute function humor_private.protect_superadmin();

create policy "Superadmins can update captions" on public.caption_generations for update to authenticated
using ((select humor_private.is_superadmin())) with check ((select humor_private.is_superadmin()));
create policy "Superadmins can delete captions" on public.caption_generations for delete to authenticated
using ((select humor_private.is_superadmin()));
create policy "Superadmins can update photo memes" on public.photo_generations for update to authenticated
using ((select humor_private.is_superadmin())) with check ((select humor_private.is_superadmin()));
create policy "Superadmins can delete photo memes" on public.photo_generations for delete to authenticated
using ((select humor_private.is_superadmin()));
create policy "Superadmins can read caption votes" on public.caption_votes for select to authenticated
using ((select humor_private.is_superadmin()));
create policy "Superadmins can read photo votes" on public.photo_votes for select to authenticated
using ((select humor_private.is_superadmin()));
create policy "Superadmins can read meme objects" on storage.objects for select to authenticated
using (bucket_id='caption-memes' and (select humor_private.is_superadmin()));
create policy "Superadmins can delete meme objects" on storage.objects for delete to authenticated
using (bucket_id='caption-memes' and (select humor_private.is_superadmin()));


-- Preserve the feed's existing column-level privacy for photo model/context.
create or replace function humor_private.admin_photos()
returns setof public.photo_generations language plpgsql stable security definer set search_path=''
as $
begin
  if auth.uid() is null or not humor_private.is_superadmin() then
    raise exception 'Superadmin access required' using errcode='42501';
  end if;
  return query select * from public.photo_generations;
end;
$;
revoke all on function humor_private.admin_photos() from public,anon;
grant execute on function humor_private.admin_photos() to authenticated;
grant update(caption,prompt,model), delete on public.caption_generations to authenticated;
grant update(caption,context,model), delete on public.photo_generations to authenticated;

create or replace function public.admin_snapshot(days integer default 30)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare result jsonb;
  today date := (now() at time zone 'America/New_York')::date;
begin
  if not humor_private.is_superadmin() then raise exception 'Superadmin access required' using errcode='42501'; end if;
  if days not in (7,30,90) then raise exception 'Invalid date range'; end if;
  with media as (
    select id,created_at,created_by,caption,prompt,model,upvotes,downvotes,'caption'::text kind,null::text image_path from public.caption_generations
    union all select id,created_at,created_by,caption,context,model,upvotes,downvotes,'photo',image_path from humor_private.admin_photos()
  ), votes as (
    select id,created_at,user_id,generation_id,value,'caption'::text kind from public.caption_votes
    union all select id,created_at,user_id,generation_id,value,'photo' from public.photo_votes
  ), period as (select * from media where created_at >= ((today - (days-1))::timestamp at time zone 'America/New_York'))
  select jsonb_build_object(
    'totals',jsonb_build_object('users',(select count(*) from public.profiles),'media',(select count(*) from media),'votes',(select count(*) from votes),
      'upvotes',(select count(*) from votes where value=1),'downvotes',(select count(*) from votes where value=-1),
      'creators',(select count(distinct created_by) from media),
      'unrated',(select count(*) from media where upvotes+downvotes=0)),
    'period',jsonb_build_object('media',(select count(*) from period),'votes',(select count(*) from votes where created_at>=((today-(days-1))::timestamp at time zone 'America/New_York')),
      'users',(select count(*) from public.profiles where created_at>=((today-(days-1))::timestamp at time zone 'America/New_York')),
      'previous_media',(select count(*) from media where created_at>=((today-(days*2-1))::timestamp at time zone 'America/New_York') and created_at<((today-(days-1))::timestamp at time zone 'America/New_York'))),
    'timeline',(select coalesce(jsonb_agg(to_jsonb(t) order by t.day),'[]') from (
      select d::date as "day",
        (select count(*) from media m where m.kind='caption' and (m.created_at at time zone 'America/New_York')::date=d::date) captions,
        (select count(*) from media m where m.kind='photo' and (m.created_at at time zone 'America/New_York')::date=d::date) photos,
        (select count(*) from votes v where (v.created_at at time zone 'America/New_York')::date=d::date) votes
      from generate_series(today-(days-1),today,'1 day')d) t),
    'leaderboard',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (
      select m.*,coalesce(nullif(trim(concat(p.first_name,' ',p.last_name)),''),'Anonymous creator') author
      from media m left join public.profiles p on p.user_id=m.created_by
      order by m.upvotes-m.downvotes desc,m.upvotes desc,m.created_at desc limit 5)t),
    'divisive',(select to_jsonb(t) from (
      select *,round(100.0*least(upvotes,downvotes)/nullif(upvotes+downvotes,0)*2) controversy
      from media where upvotes>0 and downvotes>0 order by 1.0*least(upvotes,downvotes)/(upvotes+downvotes) desc,upvotes+downvotes desc limit 1)t),
    'models',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select model,count(*) total from period group by model order by total desc)t),
    'recent',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (
      select m.id,m.caption,m.kind,m.created_at,coalesce(nullif(trim(concat(p.first_name,' ',p.last_name)),''),'Anonymous creator') author
      from media m left join public.profiles p on p.user_id=m.created_by order by m.created_at desc limit 5)t)
  ) into result;
  return result;
end;
$$;
revoke all on function public.admin_snapshot(integer) from public, anon;
grant execute on function public.admin_snapshot(integer) to authenticated;

create or replace function public.admin_media_list(search_term text default '', media_kind text default 'all', page_number integer default 1)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare result jsonb;
begin
  if not humor_private.is_superadmin() then raise exception 'Superadmin access required' using errcode='42501'; end if;
  if page_number<1 or media_kind not in ('all','caption','photo') or length(search_term)>200 then raise exception 'Invalid filters'; end if;
  with media as (
    select id,created_at,created_by,caption,prompt,model,upvotes,downvotes,'caption'::text kind,null::text image_path,null::integer width,null::integer height from public.caption_generations
    union all select id,created_at,created_by,caption,context,model,upvotes,downvotes,'photo',image_path,width,height from humor_private.admin_photos()
  ), filtered as (
    select m.*,coalesce(nullif(trim(concat(p.first_name,' ',p.last_name)),''),'Anonymous creator') author
    from media m left join public.profiles p on p.user_id=m.created_by
    where (media_kind='all' or kind=media_kind) and (search_term='' or caption ilike '%'||search_term||'%' or model ilike '%'||search_term||'%')
  )
  select jsonb_build_object('total',(select count(*) from filtered),'items',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (
    select * from filtered order by created_at desc,id limit 12 offset (page_number-1)*12)t)) into result;
  return result;
end;
$$;
revoke all on function public.admin_media_list(text,text,integer) from public,anon;
grant execute on function public.admin_media_list(text,text,integer) to authenticated;

create or replace function public.admin_vote_list(search_term text default '', vote_kind text default 'all', page_number integer default 1)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare result jsonb;
begin
  if not humor_private.is_superadmin() then raise exception 'Superadmin access required' using errcode='42501'; end if;
  if page_number<1 or vote_kind not in ('all','up','down') or length(search_term)>200 then raise exception 'Invalid filters'; end if;
  with votes as (
    select v.id,v.created_at,v.user_id,v.generation_id,v.value,c.caption,'caption'::text kind from public.caption_votes v join public.caption_generations c on c.id=v.generation_id
    union all select v.id,v.created_at,v.user_id,v.generation_id,v.value,c.caption,'photo' from public.photo_votes v join public.photo_generations c on c.id=v.generation_id
  ), filtered as (
    select v.*,coalesce(nullif(trim(concat(p.first_name,' ',p.last_name)),''),'Anonymous member') voter
    from votes v left join public.profiles p on p.user_id=v.user_id
    where (vote_kind='all' or (vote_kind='up' and value=1) or (vote_kind='down' and value=-1))
    and (search_term='' or caption ilike '%'||search_term||'%' or concat(p.first_name,' ',p.last_name) ilike '%'||search_term||'%')
  )
  select jsonb_build_object('total',(select count(*) from filtered),'items',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (
    select * from filtered order by created_at desc,id limit 20 offset (page_number-1)*20)t)) into result;
  return result;
end;
$$;
revoke all on function public.admin_vote_list(text,text,integer) from public,anon;
grant execute on function public.admin_vote_list(text,text,integer) to authenticated;
