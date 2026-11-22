import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePhoneRemote } from '@/app/stage/usePhoneRemote';
import type { PlayerState } from '@/lib/playerState';
import {
    closePlayerChannel,
    commandFromPhone,
    openPlayerChannel,
    resetFakeConnection,
    sentStates,
} from './fakeStageConnection';

vi.mock('@/app/stage/stageConnection', () => import('./fakeStageConnection'));

const PLAYING: PlayerState = { entryId: 7, position: 61, duration: 238, paused: false };

/** Renders the hook for room 1 and lets the fake channel connect. */
async function connectedRemote(state: PlayerState, onCommand = vi.fn()) {
    const hook = renderHook((props) => usePhoneRemote(props), {
        initialProps: { sessionId: 1 as number | null, state, onCommand },
    });
    await act(async () => {}); // the channel connects a moment after it opens
    return { ...hook, onCommand };
}

describe('usePhoneRemote', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        resetFakeConnection();
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it('says what plays once connected, then every three seconds', async () => {
        await connectedRemote({ ...PLAYING, paused: true });
        expect(sentStates).toEqual([{ ...PLAYING, paused: true }]);

        act(() => vi.advanceTimersByTime(2999));
        expect(sentStates).toHaveLength(1);
        act(() => vi.advanceTimersByTime(1));
        expect(sentStates).toHaveLength(2);
    });

    it('stays quiet while the time runs on as the phones count it', async () => {
        const { rerender, onCommand } = await connectedRemote(PLAYING);

        act(() => vi.advanceTimersByTime(500));
        rerender({ sessionId: 1, state: { ...PLAYING, position: 61.5 }, onCommand });
        act(() => vi.advanceTimersByTime(500));
        rerender({ sessionId: 1, state: { ...PLAYING, position: 62.2 }, onCommand });

        expect(sentStates).toHaveLength(1);
    });

    it('says so at once when the time is more than a second off', async () => {
        const { rerender, onCommand } = await connectedRemote(PLAYING);

        rerender({ sessionId: 1, state: { ...PLAYING, position: 71 }, onCommand });

        expect(sentStates.at(-1)).toEqual({ ...PLAYING, position: 71 });
    });

    it('says so at once when the song, the pause or the length changes', async () => {
        const { rerender, onCommand } = await connectedRemote(PLAYING);

        rerender({ sessionId: 1, state: { ...PLAYING, paused: true }, onCommand });
        expect(sentStates).toHaveLength(2);
        rerender({ sessionId: 1, state: { ...PLAYING, duration: 240 }, onCommand });
        expect(sentStates).toHaveLength(3);
        rerender({
            sessionId: 1,
            state: { entryId: 8, position: 0, duration: 0, paused: false },
            onCommand,
        });
        expect(sentStates.at(-1)).toEqual({ entryId: 8, position: 0, duration: 0, paused: false });
    });

    it('passes on what the phones ask for', async () => {
        const { onCommand } = await connectedRemote(PLAYING);

        commandFromPhone({ action: 'skip', entryId: 7 });

        expect(onCommand).toHaveBeenCalledWith({ action: 'skip', entryId: 7 });
    });

    it('opens nothing without a room and closes the channel when the room goes', async () => {
        const { rerender, onCommand } = await connectedRemote(PLAYING);

        rerender({ sessionId: null, state: PLAYING, onCommand });
        act(() => vi.advanceTimersByTime(6000));

        expect(openPlayerChannel).toHaveBeenCalledTimes(1);
        expect(closePlayerChannel).toHaveBeenCalledTimes(1);
        expect(sentStates).toHaveLength(1);
    });
});
