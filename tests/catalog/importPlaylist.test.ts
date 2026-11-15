import { afterEach, describe, expect, it, vi } from 'vitest';
import * as catalogDb from '@/lib/catalog/catalogDb';
import { importPlaylist, toVideoRow } from '@/lib/catalog/importPlaylist';
import type { VideoDetails } from '@/lib/catalog/youtube';
import * as youtube from '@/lib/catalog/youtube';

vi.mock('@/lib/catalog/youtube', async (importOriginal) => ({
    ...(await importOriginal<typeof youtube>()),
    fetchPlaylistPage: vi.fn(),
    fetchVideoDetails: vi.fn(),
}));
vi.mock('@/lib/catalog/catalogDb', () => ({
    ensureSongs: vi.fn(async () => new Map([['toto|africa', 7]])),
    fetchExistingVideos: vi.fn(async () => new Map()),
    upsertVideos: vi.fn(async () => {}),
    upsertVideoSources: vi.fn(async () => {}),
}));

function video(youtubeId: string, rawTitle: string, overrides: Partial<VideoDetails> = {}) {
    return {
        youtubeId,
        rawTitle,
        channelId: 'UC1',
        channelTitle: 'Musisi Karaoke',
        publishedAt: '2020-01-01T00:00:00Z',
        thumbnailUrl: null,
        durationSec: 240,
        viewCount: 1000,
        status: 'ok',
        ...overrides,
    } satisfies VideoDetails;
}

const AFRICA = video('africa', 'Toto - Africa (Karaoke Version)');

describe('importPlaylist', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    function playlist() {
        vi.mocked(youtube.fetchPlaylistPage)
            .mockResolvedValueOnce({
                items: [
                    { videoId: 'africa', position: 0 },
                    { videoId: 'deleted', position: 1 },
                    { videoId: 'clip', position: 2 },
                ],
                nextPageToken: 'page2',
            })
            .mockResolvedValueOnce({
                items: [{ videoId: 'odd', position: 3 }],
                nextPageToken: null,
            });
        vi.mocked(youtube.fetchVideoDetails)
            .mockResolvedValueOnce([
                AFRICA,
                video('clip', 'Toto - Africa (Mini Karaoke) 🎤', { durationSec: 30 }),
            ])
            .mockResolvedValueOnce([
                video('odd', 'Best Karaoke Songs Ever', { status: 'not_embeddable' }),
            ]);
    }

    it('reads every page and counts what it finds', async () => {
        playlist();
        const result = await importPlaylist('PL1', null);

        expect(youtube.fetchPlaylistPage).toHaveBeenLastCalledWith('PL1', 'page2');
        expect(result).toEqual({
            seen: 4,
            unavailable: 1,
            skipped: 1,
            songs: 2,
            unparsedTitles: ['Best Karaoke Songs Ever'],
            notPlayable: 1,
        });
    });

    it('writes nothing in a dry run', async () => {
        playlist();
        await importPlaylist('PL1', null);
        expect(catalogDb.upsertVideos).not.toHaveBeenCalled();
        expect(catalogDb.ensureSongs).not.toHaveBeenCalled();
    });

    it('saves complete songs with their song and playlist position', async () => {
        playlist();
        await importPlaylist('PL1', 3);

        expect(catalogDb.ensureSongs).toHaveBeenCalledWith([
            { artist: 'Toto', title: 'Africa', match_key: 'toto|africa' },
        ]);
        expect(catalogDb.upsertVideos).toHaveBeenCalledWith([
            expect.objectContaining({ youtube_id: 'africa', song_id: 7, needs_review: false }),
        ]);
        expect(catalogDb.upsertVideos).toHaveBeenCalledWith([
            expect.objectContaining({ youtube_id: 'odd', song_id: null, needs_review: true }),
        ]);
        expect(catalogDb.upsertVideoSources).toHaveBeenCalledWith([
            { video_id: 'africa', source_id: 3, position: 0 },
        ]);
    });
});

describe('toVideoRow', () => {
    const parsed = { artist: 'Toto', title: 'Africa', version: 'lower_key' } as const;

    it('fills in a new video from YouTube and the parsed title', () => {
        expect(toVideoRow(AFRICA, parsed, 7, undefined)).toMatchObject({
            youtube_id: 'africa',
            raw_title: 'Toto - Africa (Karaoke Version)',
            view_count: 1000,
            added_via: 'playlist',
            song_id: 7,
            version: 'lower_key',
            needs_review: false,
            status: 'ok',
        });
    });

    it('flags a video without a song for review', () => {
        expect(toVideoRow(AFRICA, null, null, undefined)).toMatchObject({
            song_id: null,
            version: 'standard',
            needs_review: true,
        });
    });

    it('keeps what was decided about an existing video but refreshes its stats', () => {
        const existing = {
            youtube_id: 'africa',
            song_id: 99,
            version: 'duet',
            needs_review: false,
            status: 'not_embeddable',
            added_via: 'manual',
        } as const;
        expect(toVideoRow({ ...AFRICA, viewCount: 5000 }, parsed, 7, existing)).toMatchObject({
            view_count: 5000,
            added_via: 'manual',
            song_id: 99,
            version: 'duet',
            status: 'not_embeddable',
        });
    });

    it('links a song to an existing video that had none', () => {
        const existing = {
            youtube_id: 'africa',
            song_id: null,
            version: 'standard',
            needs_review: true,
            status: 'ok',
            added_via: 'playlist',
        } as const;
        expect(toVideoRow(AFRICA, parsed, 7, existing)).toMatchObject({
            song_id: 7,
            needs_review: false,
        });
    });

    it('takes a new playback problem from YouTube', () => {
        expect(
            toVideoRow({ ...AFRICA, status: 'region_blocked' }, parsed, 7, undefined).status,
        ).toBe('region_blocked');
    });
});
