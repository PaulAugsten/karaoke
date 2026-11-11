import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StagePage from '@/app/stage/page';
import { installFakeYouTube, latestPlayer, resetFakeYouTube } from './fakeYouTube';

const [FIRST, SECOND] = ['dQw4w9WgXcQ', 'M7lc1UVf-VE'];

async function renderReadyStage() {
    render(<StagePage />);
    const player = await waitFor(latestPlayer);
    act(() => player.ready());
    return player;
}

function clickStart() {
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
}

describe('Stage', () => {
    beforeEach(installFakeYouTube);
    afterEach(() => {
        resetFakeYouTube();
        vi.restoreAllMocks();
    });

    it('shows a disabled loading button until the player is ready', async () => {
        render(<StagePage />);
        expect(screen.getByRole('button', { name: 'Loading...' })).toHaveAttribute(
            'aria-disabled',
            'true',
        );

        const player = await waitFor(latestPlayer);
        act(() => player.ready());

        expect(screen.getByRole('button', { name: 'Start' })).toHaveAttribute(
            'aria-disabled',
            'false',
        );
    });

    it('ignores presses before the player is ready', async () => {
        render(<StagePage />);
        const player = await waitFor(latestPlayer);

        fireEvent.click(screen.getByRole('button', { name: 'Loading...' }));

        expect(player.loadVideoById).not.toHaveBeenCalled();
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('unmutes and plays the first video on start, then hides the button', async () => {
        const player = await renderReadyStage();

        clickStart();

        expect(player.unMute).toHaveBeenCalled();
        expect(player.loadVideoById).toHaveBeenCalledWith(FIRST);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('plays the next video when one ends and stops once the queue is empty', async () => {
        const player = await renderReadyStage();
        clickStart();

        act(() => player.stateChange(YT.PlayerState.ENDED));
        expect(player.loadVideoById).toHaveBeenLastCalledWith(SECOND);

        act(() => player.stateChange(YT.PlayerState.ENDED));
        expect(player.stopVideo).toHaveBeenCalled();
    });

    it('ignores state changes other than ended', async () => {
        const player = await renderReadyStage();
        clickStart();

        act(() => player.stateChange(YT.PlayerState.PAUSED));

        expect(player.loadVideoById).toHaveBeenCalledTimes(1);
    });

    it('reports permanently unplayable videos and skips them', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const player = await renderReadyStage();
        clickStart();

        act(() => player.error(150 as YT.PlayerError));

        expect(warn).toHaveBeenCalledWith(expect.stringContaining(FIRST));
        expect(player.loadVideoById).toHaveBeenLastCalledWith(SECOND);
    });

    it('skips videos with transient errors without reporting them', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const player = await renderReadyStage();
        clickStart();

        act(() => player.error(5 as YT.PlayerError));

        expect(warn).not.toHaveBeenCalled();
        expect(player.loadVideoById).toHaveBeenLastCalledWith(SECOND);
    });
});
