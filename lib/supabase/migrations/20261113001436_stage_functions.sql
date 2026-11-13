SET local check_function_bodies = off;

ALTER TABLE "public"."sessions"
  ADD COLUMN "code" text;

CREATE OR REPLACE FUNCTION public.advance_queue (
  p_session_id bigint,
  p_current_id bigint
)
  RETURNS SETOF public.queue_items
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  playing_id bigint;
begin
  -- Lock the session row: a second call for the same session waits here
  -- until the first one commits, then sees its result.
  perform 1 from public.sessions where id = p_session_id for update;
  if not found then
    raise exception 'session % not found', p_session_id;
  end if;

  select id into playing_id
  from public.queue_items
  where session_id = p_session_id and status = 'playing';

  if playing_id is distinct from p_current_id then
    return query select * from public.queue_items where id = playing_id;
    return;
  end if;

  update public.queue_items set status = 'done' where id = playing_id;
  -- Later: insert into public.plays (...) here, using playing_id.

  return query
  update public.queue_items
  set status = 'playing'
  where id = (
    select id from public.queue_items
    where session_id = p_session_id and status = 'queued'
    order by position, id
    limit 1
  )
  returning *;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_session()
  RETURNS public.sessions
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';  -- no I/O: they look like 1/0
  new_code text;
  new_session public.sessions;
begin
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
end;
$function$;

CREATE OR REPLACE FUNCTION public.mark_video_unplayable (
  p_video_id text,
  p_code     integer
)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  update public.videos
  set status = (case p_code
                  when 100 then 'unavailable'
                  else 'not_embeddable'          -- 101 and 150
                end)::public.video_status,
      last_player_error = p_code
  where youtube_id = p_video_id
    and p_code in (100, 101, 150);
$function$;

CREATE UNIQUE INDEX queue_items_one_playing_key ON public.queue_items USING btree (session_id)
  WHERE (status = 'playing'::public.queue_status);

CREATE UNIQUE INDEX sessions_open_code ON public.sessions USING btree (code)
  WHERE (ended_at IS NULL);

CREATE POLICY "anyone can read queue" ON "public"."queue_items"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "anyone can read sessions" ON "public"."sessions"
  FOR SELECT
  TO PUBLIC
  USING (true);

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."queue_items";

GRANT EXECUTE ON FUNCTION "public"."advance_queue"(bigint, bigint) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."advance_queue"(bigint, bigint) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."advance_queue"(bigint, bigint) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."advance_queue"(bigint, bigint) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."create_session"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."create_session"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_session"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_session"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."mark_video_unplayable"(text, integer) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."mark_video_unplayable"(text, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."mark_video_unplayable"(text, integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."mark_video_unplayable"(text, integer) TO "service_role";
