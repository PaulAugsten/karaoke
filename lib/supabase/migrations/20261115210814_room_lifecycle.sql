SET local check_function_bodies = off;

ALTER TABLE "public"."sessions"
  ADD COLUMN "last_active_at" timestamp WITH time zone NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.close_stale_sessions()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform public.end_session(id)
  from public.sessions
  where ended_at is null and last_active_at < now() - interval '12 hours';
end;
$function$;

REVOKE ALL ON FUNCTION "public"."close_stale_sessions"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.create_session()
  RETURNS public.sessions
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';  -- no I/O: they look like 1/0
  new_code text;
  new_session public.sessions;
begin
  perform public.close_stale_sessions();
  for attempt in 1..10 loop
    new_code := '';
    for i in 1..4 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;

    begin
      insert into public.sessions (code) values (new_code)
      returning * into new_session;
      return new_session;
    exception when unique_violation then
      null;  -- an open session already has this code; try another
    end;
  end loop;

  raise exception 'could not find a free room code after 10 attempts';
end;$function$;

CREATE OR REPLACE FUNCTION public.end_session (
  p_session_id bigint
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  update public.sessions set ended_at = now()
  where id = p_session_id and ended_at is null;
  if not found then
    return;
  end if;

  update public.queue_items set status = 'removed'
  where session_id = p_session_id and status in ('queued', 'playing');
end;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_video (
  p_code     text,
  p_video_id text
)
  RETURNS public.queue_items
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$declare
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

  perform public.close_stale_sessions();
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
end;$function$;

CREATE OR REPLACE FUNCTION public.find_open_session (
  p_code text
)
  RETURNS SETOF public.sessions
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  perform public.close_stale_sessions();
  return query
  select * from public.sessions
  where code = upper(trim(p_code)) and ended_at is null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.join_session (
  p_code text,
  p_name text
)
  RETURNS public.sessions
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$declare
  clean_name constant text := coalesce(trim(p_name), '');
  found_session public.sessions;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if clean_name = '' or length(clean_name) > 30 then
    raise exception 'Your name must be 1 to 30 characters long';
  end if;

  perform public.close_stale_sessions();
  select * into found_session
  from public.sessions
  where code = upper(trim(p_code)) and ended_at is null;
  if not found then
    raise exception 'No open room with code %', upper(trim(p_code));
  end if;

  insert into public.singers (user_id, name)
  values (auth.uid(), clean_name)
  on conflict (user_id) do update set name = excluded.name;

  update public.sessions set last_active_at = now()
  where id = found_session.id
  returning * into found_session;


  return found_session;
end;$function$;

CREATE OR REPLACE FUNCTION public.touch_session()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  update public.sessions set last_active_at = now()
  where id = new.session_id and ended_at is null;
  return null;
end;
$function$;

CREATE TRIGGER queue_items_touch_session
  AFTER INSERT OR UPDATE ON public.queue_items
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_session();

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."sessions";

REVOKE ALL ON FUNCTION "public"."close_stale_sessions"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."close_stale_sessions"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."close_stale_sessions"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."end_session"(bigint) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."end_session"(bigint) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."end_session"(bigint) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."end_session"(bigint) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."find_open_session"(text) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."find_open_session"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."find_open_session"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."find_open_session"(text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."touch_session"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."touch_session"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."touch_session"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."touch_session"() TO "service_role";
