import { describe, expect, it } from 'vitest';
import { isFullSong, matchKey, parseKaraokeTitle } from '@/lib/catalog/parseTitle';

describe('parseKaraokeTitle', () => {
    it('splits artist and title at a spaced dash', () => {
        expect(parseKaraokeTitle('BTS - Dynamite (Karaoke Version)')).toEqual({
            artist: 'BTS',
            title: 'Dynamite',
            version: 'standard',
        });
    });

    it.each([
        ['Adele- Hello (Karaoke Version)'],
        ['Adele -Hello (Karaoke Version)'],
        ['Adele – Hello (Karaoke Version)'],
        ['Adele– Hello (Karaoke Version)'],
        ['Adele—Hello (Karaoke Version)'],
    ])('splits %j despite the missing space', (raw) => {
        expect(parseKaraokeTitle(raw)).toMatchObject({ artist: 'Adele', title: 'Hello' });
    });

    it.each([
        ['Jay-Z - Empire State Of Mind', 'Jay-Z', 'Empire State Of Mind'],
        ['a-ha- Take On Me', 'a-ha', 'Take On Me'],
        ['Blink-182 -All The Small Things', 'Blink-182', 'All The Small Things'],
        ['Rihanna - Shut Up and Drive -Remix', 'Rihanna', 'Shut Up and Drive -Remix'],
    ])('keeps hyphens inside names in %j', (raw, artist, title) => {
        expect(parseKaraokeTitle(raw)).toMatchObject({ artist, title });
    });

    it('does not split an unspaced hyphen', () => {
        expect(parseKaraokeTitle('Jay-Z Empire State Of Mind')).toBeNull();
    });

    it('reads "Title - Artist" when the source puts the title first', () => {
        expect(
            parseKaraokeTitle(
                'Die With A Smile - Lady Gaga, Bruno Mars (Karaoke Songs With Lyrics -  Original Key)',
                { titleFirst: true },
            ),
        ).toEqual({
            artist: 'Lady Gaga, Bruno Mars',
            title: 'Die With A Smile',
            version: 'standard',
        });
    });

    it('keeps the version when the title comes first', () => {
        expect(
            parseKaraokeTitle(
                'Love Is Gone (Acoustic)- Dylan Matthew, SLANDER (Karaoke Songs With Lyrics - Lower Key)',
                { titleFirst: true },
            ),
        ).toEqual({
            artist: 'Dylan Matthew, SLANDER',
            title: 'Love Is Gone',
            version: 'lower_key',
        });
    });

    it('detects the version from a bracket group', () => {
        expect(parseKaraokeTitle('Adele - Hello (Lower Key) (Karaoke Version)')).toMatchObject({
            title: 'Hello',
            version: 'lower_key',
        });
    });
});

describe('isFullSong', () => {
    it('accepts a normal karaoke video', () => {
        expect(isFullSong('Toto - Africa (Karaoke Version)', 295)).toBe(true);
        expect(isFullSong('Toto - Africa (Karaoke Version)', null)).toBe(true);
    });

    it.each([
        'Slayyyter - brand new chanel$ (Mini Karaoke) 🎤',
        'Cozy Autumn / Fall Karaoke (Vol. 1) | Karaoke Compilation',
        'Toto - Africa #shorts',
    ])('rejects "%s"', (raw) => {
        expect(isFullSong(raw, 200)).toBe(false);
    });

    it('rejects clips and long mixes by length', () => {
        expect(isFullSong('Toto - Africa (Karaoke Version)', 45)).toBe(false);
        expect(isFullSong('Toto - Africa (Karaoke Version)', 40 * 60)).toBe(false);
    });
});

describe('matchKey', () => {
    it('ignores case, accents, spaces, punctuation and featured artists', () => {
        expect(matchKey('Beyoncé', 'Halo')).toBe('beyonce|halo');
        expect(matchKey('Calvin Harris feat. Rihanna', 'This Is What You Came For')).toBe(
            'calvinharris|thisiswhatyoucamefor',
        );
        expect(matchKey('Post Malone', 'Sunflower (feat. Swae Lee)')).toBe('postmalone|sunflower');
    });

    it('gives different spellings of the same song the same key', () => {
        expect(matchKey('QUEEN', 'Bohemian Rhapsody!')).toBe(
            matchKey('Queen', 'Bohemian  Rhapsody'),
        );
        expect(matchKey('a-ha', 'Take On Me')).toBe(matchKey('A Ha', 'Take on Me'));
        expect(matchKey('Mark Kealiʻi Hoʻomalu', 'X')).toBe(matchKey("Mark Keali'i Ho'omalu", 'X'));
    });

    it('removes "ft" with or without a dot, but not words starting with it', () => {
        expect(matchKey('Calvin Harris ft Rihanna', 'Song')).toBe('calvinharris|song');
        expect(matchKey('Post Malone', 'Sunflower (ft Swae Lee)')).toBe('postmalone|sunflower');
        expect(matchKey('Daft Punk', 'Song (Fte Remix)')).toBe('daftpunk|songfteremix');
    });

    it.each([
        'Lady Gaga & Bradley Cooper',
        'Lady Gaga and Bradley Cooper',
        'Lady Gaga, Bradley Cooper',
    ])('treats "&", "and" and commas between artists alike: %s', (artist) => {
        expect(matchKey(artist, 'Shallow')).toBe('ladygagabradleycooper|shallow');
    });

    it('keeps "and" inside words', () => {
        expect(matchKey('Brandy', 'The Boy Is Mine')).toBe('brandy|theboyismine');
    });
});
