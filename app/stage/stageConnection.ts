import { createClient } from '@/lib/supabase/client';
import type { Database, Tables } from '@/lib/supabase/database.types';

export type Session = Tables<'sessions'>;
export type QueueItem = Tables<'queue_items'>;
export type PlayOutcome = Database['public']['Enums']['play_outcome'];

export { type ConnectionStatus, isSessionOpen, subscribeToQueue } from '@/lib/supabase/queue';

/** How the entry that was playing came to an end. */
export interface FinishedPlay {
    entryId: number;
    outcome: PlayOutcome;
    secondsPlayed: number;
}

/** Creates a new session with a fresh room code. */
export async function createSession(): Promise<Session> {
    const { data, error } = await createClient().rpc('create_session');
    if (error) throw error;
    return data;
}

/** Looks up a session that is still open. */
export async function findOpenSession(code: string): Promise<Session | null> {
    const { data, error } = await createClient()
        .rpc('find_open_session', {
            p_code: code,
        })
        .maybeSingle();
    if (error) throw error;
    return data;
}

/** Ends the room for everyone. */
export async function endSession(sessionId: number): Promise<void> {
    const { error } = await createClient().rpc('end_session', { p_session_id: sessionId });
    if (error) throw error;
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

/** Marks finished play as done and the next queued entry as playing. */
export async function advanceQueue(
    sessionId: number,
    finished: FinishedPlay | null,
): Promise<QueueItem | null> {
    const { data, error } = await createClient()
        .rpc('advance_queue', {
            p_session_id: sessionId,
            ...(finished && {
                p_current_id: finished.entryId,
                p_outcome: finished.outcome,
                p_seconds_played: finished.secondsPlayed,
            }),
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
