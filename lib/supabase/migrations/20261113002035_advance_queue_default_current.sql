SET local check_function_bodies = off;

DROP FUNCTION "public"."advance_queue"(bigint, bigint);

CREATE OR REPLACE FUNCTION public.advance_queue (
  p_session_id bigint,
  p_current_id bigint DEFAULT NULL::bigint
)
  RETURNS SETOF public.queue_items
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  playing_id bigint;
begin
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

GRANT EXECUTE ON FUNCTION "public"."advance_queue"(bigint, bigint) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."advance_queue"(bigint, bigint) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."advance_queue"(bigint, bigint) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."advance_queue"(bigint, bigint) TO "service_role";
