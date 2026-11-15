DROP TRIGGER "queue_items_touch_session" ON "public"."queue_items";

CREATE TRIGGER queue_items_touch_session
  AFTER INSERT OR UPDATE ON public.queue_items
  FOR EACH ROW
  WHEN ((new.picked_by = 'queue'::public.picked_by))
  EXECUTE FUNCTION public.touch_session();
