import { describe, expect, it } from 'vitest';
import { isPermanentError } from '@/app/stage/youtubeErrors';

describe('isPermanentError', () => {
    it.each([100, 101, 150])('treats %i as permanent', (code) => {
        expect(isPermanentError(code)).toBe(true);
    });

    it.each([2, 5])('treats %i as transient', (code) => {
        expect(isPermanentError(code)).toBe(false);
    });
});
