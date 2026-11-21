import { describe, expect, it } from 'vitest';
import { clampSeek, estimatePosition, parseCommand, parseState } from '@/lib/playerState';

const PLAYING = { entryId: 7, position: 61, duration: 238, paused: false };

describe('parseState', () => {
    it('takes a state as the TV sends it', () => {
        expect(parseState(PLAYING)).toEqual(PLAYING);
        expect(parseState({ entryId: null, position: 0, duration: 0, paused: false })).toEqual({
            entryId: null,
            position: 0,
            duration: 0,
            paused: false,
        });
    });

    it('drops anything else, since anyone can send on the channel', () => {
        expect(parseState(null)).toBeNull();
        expect(parseState('playing')).toBeNull();
        expect(parseState({ ...PLAYING, entryId: '7' })).toBeNull();
        expect(parseState({ ...PLAYING, position: Number.NaN })).toBeNull();
        expect(parseState({ ...PLAYING, duration: undefined })).toBeNull();
        expect(parseState({ ...PLAYING, paused: 'no' })).toBeNull();
    });
});

describe('parseCommand', () => {
    it('takes the commands a phone sends', () => {
        expect(parseCommand({ action: 'skip', entryId: 7 })).toEqual({
            action: 'skip',
            entryId: 7,
        });
        expect(parseCommand({ action: 'pause', entryId: 7 })).toEqual({
            action: 'pause',
            entryId: 7,
        });
        expect(parseCommand({ action: 'play', entryId: 7, seconds: 3 })).toEqual({
            action: 'play',
            entryId: 7,
        });
        expect(parseCommand({ action: 'seekBy', entryId: 7, seconds: -10 })).toEqual({
            action: 'seekBy',
            entryId: 7,
            seconds: -10,
        });
        expect(parseCommand({ action: 'seekTo', entryId: 7, seconds: 95 })).toEqual({
            action: 'seekTo',
            entryId: 7,
            seconds: 95,
        });
    });

    it('drops anything else, since anyone can send on the channel', () => {
        expect(parseCommand(undefined)).toBeNull();
        expect(parseCommand({ action: 'skip' })).toBeNull();
        expect(parseCommand({ action: 'rewind', entryId: 7 })).toBeNull();
        expect(parseCommand({ action: 'seekTo', entryId: 7 })).toBeNull();
        expect(parseCommand({ action: 'seekBy', entryId: 7, seconds: Infinity })).toBeNull();
    });
});

describe('estimatePosition', () => {
    it('runs on with the time since the state was taken', () => {
        expect(estimatePosition(PLAYING, 2500)).toBe(63.5);
    });

    it('stands still while paused', () => {
        expect(estimatePosition({ ...PLAYING, paused: true }, 2500)).toBe(61);
    });

    it('never runs past the end, or backwards', () => {
        expect(estimatePosition(PLAYING, 600_000)).toBe(238);
        expect(estimatePosition(PLAYING, -500)).toBe(61);
    });

    it('runs on without a limit while the length is unknown', () => {
        expect(estimatePosition({ ...PLAYING, duration: 0 }, 1000)).toBe(62);
    });
});

describe('clampSeek', () => {
    it('keeps a jump inside the song and out of its last two seconds', () => {
        expect(clampSeek(95, 238)).toBe(95);
        expect(clampSeek(-4, 238)).toBe(0);
        expect(clampSeek(500, 238)).toBe(236);
    });

    it('goes to the start while the length is unknown', () => {
        expect(clampSeek(30, 0)).toBe(0);
    });
});
