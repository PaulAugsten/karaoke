import type { Enums } from '@/lib/supabase/database.types';

type VideoVersion = Enums<'video_version'>;

export interface ParsedTitle {
    artist: string;
    title: string;
    version: VideoVersion;
}

/** Bracket groups that describe the type of video */
const KARAOKE_MARKER = /\b(karaoke|instrumental|lyrics?|backing track)\b/i;

const VERSION_MARKERS: [RegExp, VideoVersion][] = [
    [/\blower key\b/i, 'lower_key'],
    [/\bhigher key\b/i, 'higher_key'],
    [/\bduet key\b/i, 'duet'],
    [/\b(male key|female key|piano|acoustic)\b/i, 'other'],
];

/** Single out clips, compilations and shorts */
const NOT_A_FULL_SONG = /\b(mini karaoke|compilation|medley)\b|#shorts\b/i;
const MIN_DURATION_SEC = 60;
const MAX_DURATION_SEC = 10 * 60;

const BRACKET_GROUP = /\s*[([]([^)\]]*)[)\]]/g;
const ARTIST_TITLE_SEPARATOR = /\s*-\s+|\s+-\s*|\s*[–—]\s*/;
const EMOJI = /[\p{Extended_Pictographic}\p{Variation_Selector}]/gu;

/** Whether a video is one complete song */
export function isFullSong(rawTitle: string, durationSec: number | null): boolean {
    if (NOT_A_FULL_SONG.test(rawTitle)) return false;
    if (durationSec === null) return true;
    return durationSec >= MIN_DURATION_SEC && durationSec <= MAX_DURATION_SEC;
}

export interface ParseOptions {
    /** The source writes "Title - Artist" instead of "Artist - Title". */
    titleFirst?: boolean;
}

/** Splits "Artist - Title (Karaoke Version)" into its parts */
export function parseKaraokeTitle(
    rawTitle: string,
    { titleFirst = false }: ParseOptions = {},
): ParsedTitle | null {
    const [main = ''] = rawTitle.replace(EMOJI, '').split(' | ');

    let version: VideoVersion = 'standard';
    const withoutMarkers = main.replace(BRACKET_GROUP, (group, inner: string) => {
        const versionMatch = VERSION_MARKERS.find(([pattern]) => pattern.test(inner));
        if (versionMatch) {
            version = versionMatch[1];
            return '';
        }
        return KARAOKE_MARKER.test(inner) ? '' : group;
    });

    const separator = withoutMarkers.match(ARTIST_TITLE_SEPARATOR);
    if (separator?.index === undefined) return null;
    const first = withoutMarkers.slice(0, separator.index).trim();
    const second = withoutMarkers.slice(separator.index + separator[0].length).trim();
    if (!first || !second) return null;
    const [artist, title] = titleFirst ? [second, first] : [first, second];

    return { artist, title, version };
}

function normalize(text: string): string {
    return text
        .normalize('NFKD')
        .replace(/\p{M}/gu, '') // removes accents
        .toLowerCase()
        .replace(/[([]\s*(feat|ft|featuring)\b[^)\]]*[)\]]/g, '') // removes (feat. X), (ft X)
        .replace(/\s+(feat|ft|featuring)\.?\s.*$/, '') // removes "Artist feat. X"
        .replace(/&|\band\b/g, '') // "A & B", "A and B" and "A, B" all match
        .replace(/(?:[^\p{L}\p{N}]|\p{Lm})+/gu, '');
}

/** Identifies a song independent of spelling, so different uploads of it share one row. */
export function matchKey(artist: string, title: string): string {
    return `${normalize(artist)}|${normalize(title)}`;
}
