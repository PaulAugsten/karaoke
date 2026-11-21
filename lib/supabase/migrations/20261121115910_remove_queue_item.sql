SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.remove_queue_item (
  p_item_id bigint
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  item public.queue_items;
begin
  select * into item from public.queue_items where id = p_item_id;
  if not found then
    raise exception 'This song is no longer in the queue';
  end if;

  -- Lock the session row first, like every function that changes a room, then look again:
  -- the song may have started or been removed while this call waited for the lock.
  perform 1 from public.sessions where id = item.session_id for update;
  select * into item from public.queue_items where id = p_item_id;

  if item.status = 'removed' then
    return;  -- a double tap
  end if;
  if item.singer_id is distinct from (select id from public.singers where user_id = auth.uid()) then
    raise exception 'You can only remove your own songs';
  end if;
  if item.status <> 'queued' then
    raise exception 'This song has already started';
  end if;

  update public.queue_items set status = 'removed' where id = p_item_id;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."remove_queue_item"(bigint) FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."remove_queue_item"(bigint) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."remove_queue_item"(bigint) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."remove_queue_item"(bigint) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."remove_queue_item"(bigint) TO "service_role";
