import { describe, expect, it } from 'vitest';
import { formatTime } from '@/lib/formatTime';

describe('formatTime', () => {
    it('shows minutes and two-digit seconds', () => {
        expect(formatTime(0)).toBe('0:00');
        expect(formatTime(61)).toBe('1:01');
        expect(formatTime(238)).toBe('3:58');
    });

    it('drops the fraction instead of rounding up', () => {
        expect(formatTime(59.9)).toBe('0:59');
    });

    it('keeps counting minutes past an hour', () => {
        expect(formatTime(3725)).toBe('62:05');
    });

    it('never shows a negative time', () => {
        expect(formatTime(-3)).toBe('0:00');
    });
});
