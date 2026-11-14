import { createClient } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/database.types';

export type Session = Tables<'sessions'>;
export type QueueItem = Tables<'queue_items'>;

export { type ConnectionStatus, subscribeToQueue } from '@/lib/supabase/queue';

/** Creates a new session with a fresh room code. */
export async function createSession(): Promise<Session> {
    const { data, error } = await createClient().rpc('create_session');
    if (error) throw error;
    return data;
}

/** Looks up a session that is still open. */
export async function findOpenSession(code: string): Promise<Session | null> {
    const { data, error } = await createClient()
        .from('sessions')
        .select('*')
        .eq('code', code)
        .is('ended_at', null)
        .maybeSingle();
    if (error) throw error;
    return data;
}

/** The entries still relevant to the stage */
export async function fetchQueue(sessionId: number): Promise<QueueItem[]> {
    const { data, error } = await createClient()
        .from('queue_items')
        .select('*')
        .eq('session_id', sessionId)
        .in('status', ['queued', 'playing'])
        .order('position')
        .order('id');
    if (error) throw error;
    return data;
}

/** Marks currentId as done and the next queued entry as playing. */
export async function advanceQueue(
    sessionId: number,
    currentId: number | null,
): Promise<QueueItem | null> {
    const { data, error } = await createClient()
        .rpc('advance_queue', {
            p_session_id: sessionId,
            ...(currentId !== null && { p_current_id: currentId }),
        })
        .maybeSingle();
    if (error) throw error;
    return data;
}

export async function reportUnplayable(videoId: string, code: number): Promise<void> {
    const { error } = await createClient().rpc('mark_video_unplayable', {
        p_video_id: videoId,
        p_code: code,
    });
    if (error) throw error;
}
