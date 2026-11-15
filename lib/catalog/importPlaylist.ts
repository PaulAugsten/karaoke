import type { TablesInsert } from '@/lib/supabase/database.types';
import {
    type ExistingVideo,
    ensureSongs,
    fetchExistingVideos,
    upsertVideoSources,
    upsertVideos,
} from './catalogDb';
import {
    isFullSong,
    matchKey,
    type ParsedTitle,
    type ParseOptions,
    parseKaraokeTitle,
} from './parseTitle';
import { fetchPlaylistPage, fetchVideoDetails, type VideoDetails } from './youtube';

export interface ImportResult {
    /** Entries in the playlist. */
    seen: number;
    /** Deleted or private videos. */
    unavailable: number;
    /** Clips, compilations, shorts and overlong videos. */
    skipped: number;
    /** Complete songs that are saved */
    songs: number;
    /** Songs whose title couldn't be split into artist and title. */
    unparsedTitles: string[];
    /** Songs YouTube says the stage can't play. */
    notPlayable: number;
}

interface Entry {
    video: VideoDetails;
    parsed: ParsedTitle | null;
    position: number;
}

/** Imports every complete song of a YouTube playlist. */
export async function importPlaylist(
    playlistId: string,
    sourceId: number | null,
    parseOptions: ParseOptions = {},
): Promise<ImportResult> {
    const result: ImportResult = {
        seen: 0,
        unavailable: 0,
        skipped: 0,
        songs: 0,
        unparsedTitles: [],
        notPlayable: 0,
    };

    let pageToken: string | null = null;
    do {
        const page = await fetchPlaylistPage(playlistId, pageToken);
        const positions = new Map(page.items.map((item) => [item.videoId, item.position]));
        const videos = await fetchVideoDetails([...positions.keys()]);
        const entries: Entry[] = videos
            .filter((video) => isFullSong(video.rawTitle, video.durationSec))
            .map((video) => ({
                video,
                parsed: parseKaraokeTitle(video.rawTitle, parseOptions),
                position: positions.get(video.youtubeId) ?? 0,
            }));

        result.seen += page.items.length;
        result.unavailable += positions.size - videos.length;
        result.skipped += videos.length - entries.length;
        result.songs += entries.length;
        result.notPlayable += entries.filter(({ video }) => video.status !== 'ok').length;
        for (const { video, parsed } of entries) {
            if (!parsed) result.unparsedTitles.push(video.rawTitle);
        }

        if (sourceId !== null) await saveEntries(entries, sourceId);
        pageToken = page.nextPageToken;
    } while (pageToken);

    return result;
}

async function saveEntries(entries: Entry[], sourceId: number): Promise<void> {
    const songIds = await ensureSongs(
        entries.flatMap(({ parsed }) =>
            parsed
                ? [
                      {
                          artist: parsed.artist,
                          title: parsed.title,
                          match_key: matchKey(parsed.artist, parsed.title),
                      },
                  ]
                : [],
        ),
    );
    const existing = await fetchExistingVideos(entries.map(({ video }) => video.youtubeId));

    await upsertVideos(
        entries.map(({ video, parsed }) =>
            toVideoRow(
                video,
                parsed,
                parsed ? (songIds.get(matchKey(parsed.artist, parsed.title)) ?? null) : null,
                existing.get(video.youtubeId),
            ),
        ),
    );
    await upsertVideoSources(
        entries.map(({ video, position }) => ({
            video_id: video.youtubeId,
            source_id: sourceId,
            position,
        })),
    );
}

/** The row to write for a video */
export function toVideoRow(
    video: VideoDetails,
    parsed: ParsedTitle | null,
    songId: number | null,
    existing: ExistingVideo | undefined,
): TablesInsert<'videos'> {
    const linked = existing?.song_id != null;
    return {
        youtube_id: video.youtubeId,
        raw_title: video.rawTitle,
        channel_id: video.channelId,
        channel_title: video.channelTitle,
        published_at: video.publishedAt,
        thumbnail_url: video.thumbnailUrl,
        duration_sec: video.durationSec,
        view_count: video.viewCount,
        stats_fetched_at: new Date().toISOString(),
        added_via: existing?.added_via ?? 'playlist',
        song_id: linked ? existing.song_id : songId,
        version: linked ? existing.version : (parsed?.version ?? 'standard'),
        needs_review: linked ? existing.needs_review : songId === null,
        status: video.status === 'ok' ? (existing?.status ?? 'ok') : video.status,
    };
}
