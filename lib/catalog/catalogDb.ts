import { createAdminClient } from '@/lib/supabase/admin';
import type { Tables, TablesInsert } from '@/lib/supabase/database.types';
import type { Playlist } from './youtube';

/** Database access for the catalog import. */

export type Source = Pick<Tables<'sources'>, 'id' | 'youtube_playlist_id' | 'name' | 'title_first'>;
const SOURCE_COLUMNS = 'id, youtube_playlist_id, name, title_first';
export type ExistingVideo = Pick<
    Tables<'videos'>,
    'youtube_id' | 'song_id' | 'version' | 'needs_review' | 'status' | 'added_via'
>;

export async function fetchEnabledSources(): Promise<Source[]> {
    const { data, error } = await createAdminClient()
        .from('sources')
        .select(SOURCE_COLUMNS)
        .eq('enabled', true)
        .order('id');
    if (error) throw error;
    return data;
}

/**
 * Registers playlists as sources or refreshes their names if they already are.
 * Pass titleFirst to set the title order; leave it out to keep the stored one.
 */
export async function upsertSources(
    playlists: Playlist[],
    titleFirst?: boolean,
): Promise<Source[]> {
    if (playlists.length === 0) return [];
    const { data, error } = await createAdminClient()
        .from('sources')
        .upsert(
            playlists.map((playlist) => ({
                youtube_playlist_id: playlist.id,
                name: playlist.title,
                channel_title: playlist.channelTitle,
                ...(titleFirst === undefined ? {} : { title_first: titleFirst }),
            })),
            { onConflict: 'youtube_playlist_id' },
        )
        .select(SOURCE_COLUMNS);
    if (error) throw error;
    return data;
}

export async function markSourceSynced(sourceId: number): Promise<void> {
    const { error } = await createAdminClient()
        .from('sources')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', sourceId);
    if (error) throw error;
}

/** Creates the songs that don't exist yet */
export async function ensureSongs(
    songs: Pick<Tables<'songs'>, 'artist' | 'title' | 'match_key'>[],
): Promise<Map<string, number>> {
    if (songs.length === 0) return new Map();
    const supabase = createAdminClient();
    const { error } = await supabase
        .from('songs')
        .upsert(songs, { onConflict: 'match_key', ignoreDuplicates: true });
    if (error) throw error;

    const { data, error: selectError } = await supabase
        .from('songs')
        .select('id, match_key')
        .in(
            'match_key',
            songs.map((song) => song.match_key),
        );
    if (selectError) throw selectError;
    return new Map(data.map((song) => [song.match_key, song.id]));
}

export async function fetchExistingVideos(
    youtubeIds: string[],
): Promise<Map<string, ExistingVideo>> {
    if (youtubeIds.length === 0) return new Map();
    const { data, error } = await createAdminClient()
        .from('videos')
        .select('youtube_id, song_id, version, needs_review, status, added_via')
        .in('youtube_id', youtubeIds);
    if (error) throw error;
    return new Map(data.map((video) => [video.youtube_id, video]));
}

export async function upsertVideos(videos: TablesInsert<'videos'>[]): Promise<void> {
    if (videos.length === 0) return;
    const { error } = await createAdminClient()
        .from('videos')
        .upsert(videos, { onConflict: 'youtube_id' });
    if (error) throw error;
}

/** Records where each video sits in the source playlist. */
export async function upsertVideoSources(
    links: Pick<TablesInsert<'video_sources'>, 'video_id' | 'source_id' | 'position'>[],
): Promise<void> {
    if (links.length === 0) return;
    const { error } = await createAdminClient()
        .from('video_sources')
        .upsert(links, { onConflict: 'video_id,source_id' });
    if (error) throw error;
}
