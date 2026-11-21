SET local check_function_bodies = off;

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
