import { describe, expect, it } from 'vitest';
import {
    type ApiVideo,
    parseDuration,
    toVideoDetails,
    type VideoStatus,
} from '@/lib/catalog/youtube';

function apiVideo(overrides: {
    contentDetails?: Partial<ApiVideo['contentDetails']>;
    status?: Partial<ApiVideo['status']>;
    statistics?: ApiVideo['statistics'];
}): ApiVideo {
    return {
        id: 'abc123',
        snippet: {
            title: 'Toto - Africa (Karaoke Version)',
            channelId: 'UCwTRjvjVge51X-ILJ4i22ew',
            channelTitle: 'Musisi Karaoke',
            publishedAt: '2020-01-01T00:00:00Z',
            thumbnails: { medium: { url: 'https://i.ytimg.com/vi/abc123/mqdefault.jpg' } },
        },
        contentDetails: { duration: 'PT4M55S', ...overrides.contentDetails },
        statistics: overrides.statistics ?? { viewCount: '1234' },
        status: { embeddable: true, privacyStatus: 'public', ...overrides.status },
    };
}

describe('parseDuration', () => {
    it.each([
        ['PT4M55S', 295],
        ['PT1H3M7S', 3787],
        ['PT45S', 45],
        ['PT3M', 180],
        ['P1DT2H', 93_600],
        ['P0D', 0],
    ])('converts %s', (iso, seconds) => {
        expect(parseDuration(iso)).toBe(seconds);
    });

    it('returns null for something it cannot read', () => {
        expect(parseDuration('four minutes')).toBeNull();
    });
});

describe('toVideoDetails', () => {
    it('maps the API fields', () => {
        expect(toVideoDetails(apiVideo({}))).toEqual({
            youtubeId: 'abc123',
            rawTitle: 'Toto - Africa (Karaoke Version)',
            channelId: 'UCwTRjvjVge51X-ILJ4i22ew',
            channelTitle: 'Musisi Karaoke',
            publishedAt: '2020-01-01T00:00:00Z',
            thumbnailUrl: 'https://i.ytimg.com/vi/abc123/mqdefault.jpg',
            durationSec: 295,
            viewCount: 1234,
            status: 'ok',
        });
    });

    it('leaves the view count empty when it is hidden', () => {
        expect(toVideoDetails(apiVideo({ statistics: {} })).viewCount).toBeNull();
    });

    it.each<[Parameters<typeof apiVideo>[0], VideoStatus]>([
        [{ status: { embeddable: false } }, 'not_embeddable'],
        [{ contentDetails: { contentRating: { ytRating: 'ytAgeRestricted' } } }, 'age_restricted'],
        [{ contentDetails: { regionRestriction: { blocked: ['DE', 'AT'] } } }, 'region_blocked'],
        [{ contentDetails: { regionRestriction: { allowed: ['US'] } } }, 'region_blocked'],
        [{ contentDetails: { regionRestriction: { allowed: ['DE', 'US'] } } }, 'ok'],
        [{ contentDetails: { regionRestriction: { blocked: ['US'] } } }, 'ok'],
    ])('derives the playback status from %j', (overrides, status) => {
        expect(toVideoDetails(apiVideo(overrides)).status).toBe(status);
    });
});
