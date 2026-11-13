SET local check_function_bodies = off;

ALTER TABLE "public"."singers"
  ADD COLUMN "user_id" uuid;

ALTER TABLE "public"."sessions"
  ALTER COLUMN "code" SET NOT NULL;

CREATE OR REPLACE FUNCTION public.enqueue_video (
  p_code     text,
  p_video_id text
)
  RETURNS public.queue_items
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  my_singer_id bigint;
  target_session_id bigint;
  new_item public.queue_items;
begin
  select id into my_singer_id
  from public.singers
  where user_id = auth.uid();
  if my_singer_id is null then
    raise exception 'Join the room first';
  end if;

  -- Locks the session row, like advance_queue, so concurrent adds get distinct positions.
  select id into target_session_id
  from public.sessions
  where code = upper(trim(p_code)) and ended_at is null
  for update;
  if target_session_id is null then
    raise exception 'This room is closed';
  end if;

  if not exists (
    select 1 from public.videos
    where youtube_id = p_video_id and status = 'ok'
  ) then
    raise exception 'This video can''t be played';
  end if;

  if exists (
    select 1 from public.queue_items
    where session_id = target_session_id
      and video_id = p_video_id
      and status in ('queued', 'playing')
  ) then
    raise exception 'This song is already in the queue';
  end if;

  insert into public.queue_items (session_id, video_id, singer_id, position)
  values (
    target_session_id,
    p_video_id,
    my_singer_id,
    coalesce((select max(position) from public.queue_items where session_id = target_session_id), 0) + 1
  )
  returning * into new_item;

  return new_item;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."enqueue_video"(text, text) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.join_session (
  p_code text,
  p_name text
)
  RETURNS public.sessions
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  clean_name constant text := coalesce(trim(p_name), '');
  found_session public.sessions;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if clean_name = '' or length(clean_name) > 30 then
    raise exception 'Your name must be 1 to 30 characters long';
  end if;

  select * into found_session
  from public.sessions
  where code = upper(trim(p_code)) and ended_at is null;
  if not found then
    raise exception 'No open room with code %', upper(trim(p_code));
  end if;

  insert into public.singers (user_id, name)
  values (auth.uid(), clean_name)
  on conflict (user_id) do update set name = excluded.name;

  return found_session;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."join_session"(text, text) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.search_videos (
  p_query text
)
  RETURNS TABLE (
    video_id text,
    artist   text,
    title    text
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select v.youtube_id,
         coalesce(s.artist, ''),
         coalesce(nullif(s.title, ''), v.raw_title)
  from public.videos v
  left join public.songs s on s.id = v.song_id
  where v.status = 'ok'
    and length(trim(p_query)) >= 2
    and not exists (
      select 1
      from regexp_split_to_table(trim(p_query), '\s+') as w(word)
      where concat_ws(' ', s.artist, s.title, v.raw_title) not ilike '%' || w.word || '%'
    )
  order by s.lastfm_listeners desc nulls last, v.view_count desc nulls last
  limit 30;
$function$;

ALTER TABLE "public"."singers"
  ADD CONSTRAINT "singers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."singers"
  ADD CONSTRAINT "singers_user_id_key" UNIQUE (user_id);

CREATE POLICY "anyone can read singers" ON "public"."singers"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "anyone can read songs" ON "public"."songs"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "anyone can read videos" ON "public"."videos"
  FOR SELECT
  TO PUBLIC
  USING (true);

GRANT EXECUTE ON FUNCTION "public"."enqueue_video"(text, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."enqueue_video"(text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."enqueue_video"(text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."enqueue_video"(text, text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."join_session"(text, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."join_session"(text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."join_session"(text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."join_session"(text, text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."search_videos"(text) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."search_videos"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."search_videos"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."search_videos"(text) TO "service_role";
