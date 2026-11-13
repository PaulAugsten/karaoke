import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StagePage from '@/app/stage/page';
import {
    addEntry,
    advanceQueue,
    createSession,
    notifyChange,
    reportUnplayable,
    resetFakeConnection,
    SESSION,
} from './fakeStageConnection';
import { installFakeYouTube, latestPlayer, resetFakeYouTube } from './fakeYouTube';

vi.mock('@/app/stage/stageConnection', () => import('./fakeStageConnection'));

const [FIRST, SECOND, THIRD] = ['dQw4w9WgXcQ', 'M7lc1UVf-VE', 'jNQXAC9IVRw'];

async function renderReadyStage() {
    render(<StagePage />);
    const player = await waitFor(latestPlayer);
    act(() => player.ready());
    return player;
}

function clickButton(name: string) {
    fireEvent.click(screen.getByRole('button', { name }));
}

/** Renders the stage, presses Start and waits until the first video loads. */
async function startedStage() {
    const player = await renderReadyStage();
    clickButton('Start');
    await waitFor(() => expect(player.loadVideoById).toHaveBeenCalledWith(FIRST));
    return player;
}

describe('Stage', () => {
    beforeEach(installFakeYouTube);
    afterEach(() => {
        resetFakeYouTube();
        resetFakeConnection();
        vi.clearAllMocks();
        vi.restoreAllMocks();
        window.history.replaceState(null, '', '/');
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
        await waitFor(latestPlayer);

        clickButton('Loading...');

        expect(createSession).not.toHaveBeenCalled();
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('creates a room on start, shows its code and plays the first entry', async () => {
        addEntry(FIRST);
        addEntry(SECOND);
        const player = await renderReadyStage();

        clickButton('Start');

        expect(player.unMute).toHaveBeenCalled();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(await screen.findByText(SESSION.code!)).toBeInTheDocument();
        expect(window.location.search).toBe(`?room=${SESSION.code}`);
        await waitFor(() => expect(player.loadVideoById).toHaveBeenCalledWith(FIRST));
    });

    it('plays the next entry when one ends and stops once the queue is empty', async () => {
        const first = addEntry(FIRST);
        addEntry(SECOND);
        const player = await startedStage();

        act(() => player.stateChange(YT.PlayerState.ENDED));
        await waitFor(() => expect(player.loadVideoById).toHaveBeenLastCalledWith(SECOND));
        expect(advanceQueue).toHaveBeenLastCalledWith(SESSION.id, first.id);

        act(() => player.stateChange(YT.PlayerState.ENDED));
        await waitFor(() => expect(player.stopVideo).toHaveBeenCalled());
    });

    it('does not skip a song when ENDED fires twice', async () => {
        addEntry(FIRST);
        addEntry(SECOND);
        addEntry(THIRD);
        const player = await startedStage();

        act(() => {
            player.stateChange(YT.PlayerState.ENDED);
            player.stateChange(YT.PlayerState.ENDED);
        });

        await waitFor(() => expect(player.loadVideoById).toHaveBeenLastCalledWith(SECOND));
        expect(player.loadVideoById).not.toHaveBeenCalledWith(THIRD);
    });

    it('ignores state changes other than ended', async () => {
        addEntry(FIRST);
        const player = await startedStage();
        const callsBefore = advanceQueue.mock.calls.length;

        act(() => player.stateChange(YT.PlayerState.PAUSED));

        expect(advanceQueue).toHaveBeenCalledTimes(callsBefore);
        expect(player.loadVideoById).toHaveBeenCalledTimes(1);
    });

    it('starts playing when a song is added to an empty queue', async () => {
        const player = await renderReadyStage();
        clickButton('Start');
        await screen.findByText(SESSION.code!);
        expect(player.loadVideoById).not.toHaveBeenCalled();

        addEntry(FIRST);
        act(() => notifyChange());

        await waitFor(() => expect(player.loadVideoById).toHaveBeenCalledWith(FIRST));
    });

    it('resumes the room from the URL after a reload', async () => {
        addEntry(FIRST, 'done');
        addEntry(SECOND, 'playing');
        window.history.replaceState(null, '', `/stage?room=${SESSION.code}`);
        const player = await renderReadyStage();

        await screen.findByRole('button', { name: 'Resume' });
        clickButton('Resume');

        await waitFor(() => expect(player.loadVideoById).toHaveBeenCalledWith(SECOND));
        expect(createSession).not.toHaveBeenCalled();
    });

    it('reports permanently unplayable videos and skips them', async () => {
        addEntry(FIRST);
        addEntry(SECOND);
        const player = await startedStage();

        act(() => player.error(150 as YT.PlayerError));

        expect(reportUnplayable).toHaveBeenCalledWith(FIRST, 150);
        await waitFor(() => expect(player.loadVideoById).toHaveBeenLastCalledWith(SECOND));
    });

    it('skips videos with transient errors without reporting them', async () => {
        addEntry(FIRST);
        addEntry(SECOND);
        const player = await startedStage();

        act(() => player.error(5 as YT.PlayerError));

        expect(reportUnplayable).not.toHaveBeenCalled();
        await waitFor(() => expect(player.loadVideoById).toHaveBeenLastCalledWith(SECOND));
    });

    it('shows database errors on screen', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        createSession.mockRejectedValueOnce(new Error('network down'));
        await renderReadyStage();

        clickButton('Start');

        expect(await screen.findByRole('alert')).toHaveTextContent('network down');
    });
});
