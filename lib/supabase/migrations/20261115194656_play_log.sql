SET local check_function_bodies = off;

DROP FUNCTION "public"."advance_queue"(bigint, bigint);

ALTER TABLE "public"."queue_items"
  ADD COLUMN "picked_by" public.picked_by NOT NULL DEFAULT 'queue'::public.picked_by;

ALTER TABLE "public"."queue_items"
  ADD COLUMN "started_at" timestamp WITH time zone;

ALTER TABLE "public"."singers"
  ADD COLUMN "guest_of_honour" boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.advance_queue (
  p_session_id     bigint,
  p_current_id     bigint              DEFAULT NULL::bigint,
  p_outcome        public.play_outcome DEFAULT NULL::public.play_outcome,
  p_seconds_played integer             DEFAULT NULL::integer
)
  RETURNS SETOF public.queue_items
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  current_item public.queue_items;
begin
  perform 1 from public.sessions where id = p_session_id for update;
  if not found then
    raise exception 'session % not found', p_session_id;
  end if;

  select * into current_item
  from public.queue_items
  where session_id = p_session_id and status = 'playing';

  if current_item.id is distinct from p_current_id then
    return query select * from public.queue_items where id = current_item.id;
    return;
  end if;

  if current_item.id is not null then
    update public.queue_items set status = 'done' where id = current_item.id;

    insert into public.plays
      (session_id, video_id, song_id, singer_id, picked_by,
       started_at, ended_at, seconds_played, outcome)
    values (
      p_session_id,
      current_item.video_id,
      (select song_id from public.videos where youtube_id = current_item.video_id),
      current_item.singer_id,
      current_item.picked_by,
      coalesce(current_item.started_at, now()),
      now(),
      case when p_seconds_played is not null then greatest(p_seconds_played, 0) end,
      p_outcome
    );
  end if;

  return query
  update public.queue_items
  set status = 'playing', started_at = now()
  where id = (
    select id from public.queue_items
    where session_id = p_session_id and status = 'queued'
    order by position, id
    limit 1
  )
  returning *;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."advance_queue"(bigint, bigint, public.play_outcome, integer) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."advance_queue"(bigint, bigint, public.play_outcome, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."advance_queue"(bigint, bigint, public.play_outcome, integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."advance_queue"(bigint, bigint, public.play_outcome, integer) TO "service_role";
