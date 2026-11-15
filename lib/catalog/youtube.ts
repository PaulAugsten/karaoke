import { requireEnv } from '@/lib/env';
import type { Enums } from '@/lib/supabase/database.types';

/**
 * Minimal YouTube Data API v3 client for the catalog import. Every call costs one
 * unit of the free 10,000-units-a-day quota and returns at most 50 items.
 */

const API = 'https://www.googleapis.com/youtube/v3';
const PAGE_SIZE = 50;

/** Videos blocked in this country are stored as region_blocked */
const PLAYBACK_REGION = 'DE';

export type VideoStatus = Enums<'video_status'>;

export interface Playlist {
    id: string;
    title: string;
    channelTitle: string;
    itemCount: number;
}

export interface PlaylistPage {
    items: { videoId: string; position: number }[];
    nextPageToken: string | null;
}

export interface VideoDetails {
    youtubeId: string;
    rawTitle: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    thumbnailUrl: string | null;
    durationSec: number | null;
    viewCount: number | null;
    status: VideoStatus;
}

export interface ApiVideo {
    id: string;
    snippet: {
        title: string;
        channelId: string;
        channelTitle: string;
        publishedAt: string;
        thumbnails?: Record<string, { url: string } | undefined>;
    };
    contentDetails: {
        duration: string;
        regionRestriction?: { allowed?: string[]; blocked?: string[] };
        contentRating?: { ytRating?: string };
    };
    statistics?: { viewCount?: string };
    status: { embeddable: boolean; privacyStatus: string };
}

async function get<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${API}/${endpoint}`);
    url.search = new URLSearchParams({
        ...Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '')),
        key: requireEnv('YOUTUBE_API_KEY', process.env.YOUTUBE_API_KEY),
    }).toString();
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(
            `YouTube ${endpoint} failed (${response.status}): ${await response.text()}`,
        );
    }
    return (await response.json()) as T;
}

interface ApiPlaylist {
    id: string;
    snippet: { title: string; channelTitle: string };
    contentDetails: { itemCount: number };
}

function toPlaylist(item: ApiPlaylist): Playlist {
    return {
        id: item.id,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        itemCount: item.contentDetails.itemCount,
    };
}

/** All public playlists of a channel, looked up by its handle (e.g. "@..."). */
export async function fetchChannelPlaylists(handle: string): Promise<Playlist[]> {
    const channels = await get<{ items?: { id: string }[] }>('channels', {
        part: 'id',
        forHandle: handle,
    });
    const channelId = channels.items?.[0]?.id;
    if (!channelId) throw new Error(`No channel with the handle ${handle}`);

    const playlists: Playlist[] = [];
    let pageToken = '';
    do {
        const page = await get<{ items: ApiPlaylist[]; nextPageToken?: string }>('playlists', {
            part: 'snippet,contentDetails',
            channelId,
            maxResults: String(PAGE_SIZE),
            pageToken,
        });
        playlists.push(...page.items.map(toPlaylist));
        pageToken = page.nextPageToken ?? '';
    } while (pageToken);
    return playlists;
}

/** Title and channel of the given playlists */
export async function fetchPlaylists(ids: string[]): Promise<Playlist[]> {
    if (ids.length === 0) return [];
    const { items } = await get<{ items: ApiPlaylist[] }>('playlists', {
        part: 'snippet,contentDetails',
        id: ids.join(','),
        maxResults: String(PAGE_SIZE),
    });
    return items.map(toPlaylist);
}

/** One page of a playlist's entries. Pass the previous page's token to continue. */
export async function fetchPlaylistPage(
    playlistId: string,
    pageToken: string | null,
): Promise<PlaylistPage> {
    const page = await get<{
        items: { contentDetails: { videoId: string }; snippet: { position: number } }[];
        nextPageToken?: string;
    }>('playlistItems', {
        part: 'snippet,contentDetails',
        playlistId,
        maxResults: String(PAGE_SIZE),
        pageToken: pageToken ?? '',
    });
    return {
        items: page.items.map((item) => ({
            videoId: item.contentDetails.videoId,
            position: item.snippet.position,
        })),
        nextPageToken: page.nextPageToken ?? null,
    };
}

/** Details of up to 50 videos. */
export async function fetchVideoDetails(videoIds: string[]): Promise<VideoDetails[]> {
    if (videoIds.length === 0) return [];
    const { items } = await get<{ items: ApiVideo[] }>('videos', {
        part: 'snippet,contentDetails,statistics,status',
        id: videoIds.join(','),
        maxResults: String(PAGE_SIZE),
    });
    return items.filter((item) => item.status.privacyStatus !== 'private').map(toVideoDetails);
}

export function toVideoDetails(item: ApiVideo): VideoDetails {
    const { snippet, contentDetails } = item;
    const viewCount = Number(item.statistics?.viewCount);
    return {
        youtubeId: item.id,
        rawTitle: snippet.title,
        channelId: snippet.channelId,
        channelTitle: snippet.channelTitle,
        publishedAt: snippet.publishedAt,
        thumbnailUrl: snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? null,
        durationSec: parseDuration(contentDetails.duration),
        viewCount: Number.isFinite(viewCount) ? viewCount : null,
        status: playbackStatus(item),
    };
}

/** Whether the stage's embedded player can play this video in PLAYBACK_REGION. */
function playbackStatus({ status, contentDetails }: ApiVideo): VideoStatus {
    if (!status.embeddable) return 'not_embeddable';
    if (contentDetails.contentRating?.ytRating === 'ytAgeRestricted') return 'age_restricted';
    const { allowed, blocked } = contentDetails.regionRestriction ?? {};
    if (blocked?.includes(PLAYBACK_REGION)) return 'region_blocked';
    if (allowed && !allowed.includes(PLAYBACK_REGION)) return 'region_blocked';
    return 'ok';
}

/** Converts an ISO duration to seconds. */
export function parseDuration(iso: string): number | null {
    const match = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    if (!match) return null;
    const [, days = '0', hours = '0', minutes = '0', seconds = '0'] = match;
    return ((Number(days) * 24 + Number(hours)) * 60 + Number(minutes)) * 60 + Number(seconds);
}
