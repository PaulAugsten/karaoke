import { createClient } from '@/lib/supabase/client';
import type { Database, Tables } from '@/lib/supabase/database.types';

export { type ConnectionStatus, subscribeToQueue } from '@/lib/supabase/queue';

export type Session = Tables<'sessions'>;
export type SearchResult = Database['public']['Functions']['search_videos']['Returns'][number];

/** A queue entry as the phone shows it. */
export interface QueueEntry {
    id: number;
    status: Tables<'queue_items'>['status'];
    title: string;
    artist: string;
    singer: string | null;
}

/** Gives this device an anonymous account the first time and reuses it afterwards. */
async function ensureSignedIn(): Promise<void> {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (data.session) return;
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
}

/** Signs in if needed, then joins the open session with this code under the given name. */
export async function joinSession(code: string, name: string): Promise<Session> {
    await ensureSignedIn();
    const { data, error } = await createClient().rpc('join_session', {
        p_code: code,
        p_name: name,
    });
    if (error) throw error;
    return data;
}

/** Playable videos whose artist or title contain every word of the query. */
export async function searchVideos(query: string, signal: AbortSignal): Promise<SearchResult[]> {
    const { data, error } = await createClient()
        .rpc('search_videos', { p_query: query })
        .abortSignal(signal);
    if (error) throw error;
    return data;
}

/** Adds a video to the end of the queue, sung by the signed-in singer */
export async function enqueueVideo(roomCode: string, videoId: string): Promise<void> {
    const { error } = await createClient().rpc('enqueue_video', {
        p_code: roomCode,
        p_video_id: videoId,
    });
    if (error) throw error;
}

/** The entries still to come. */
export async function fetchQueue(sessionId: number): Promise<QueueEntry[]> {
    const { data, error } = await createClient()
        .from('queue_items')
        .select('id, status, singers(name), videos(raw_title, songs(artist, title))')
        .eq('session_id', sessionId)
        .in('status', ['queued', 'playing'])
        .order('position')
        .order('id');
    if (error) throw error;
    return data.map((row) => ({
        id: row.id,
        status: row.status,
        title: row.videos.songs?.title || row.videos.raw_title,
        artist: row.videos.songs?.artist ?? '',
        singer: row.singers?.name ?? null,
    }));
}
