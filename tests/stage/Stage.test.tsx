import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StagePage from '@/app/stage/page';
import {
    addEntry,
    advanceQueue,
    closeRoom,
    createSession,
    endSession,
    fetchQueue,
    findOpenSession,
    notifyChange,
    reportUnplayable,
    resetFakeConnection,
    SESSION,
    subscribeToQueue,
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

function press(key: string) {
    fireEvent.keyDown(document.activeElement ?? document.body, { key });
}

function corner() {
    return screen.getByRole('button', { name: 'End party' }).parentElement!;
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
        vi.useRealTimers();
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
        expect(
            screen.queryByRole('button', {
                name: 'Start',
            }),
        ).not.toBeInTheDocument();
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
        expect(advanceQueue).toHaveBeenLastCalledWith(SESSION.id, {
            entryId: first.id,
            outcome: 'completed',
            secondsPlayed: 0,
        });

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

    it('logs a completed play with the seconds played', async () => {
        const first = addEntry(FIRST);
        addEntry(SECOND);
        const player = await startedStage();
        player.getCurrentTime.mockReturnValue(214.6);

        act(() => player.stateChange(YT.PlayerState.ENDED));

        await waitFor(() => expect(player.loadVideoById).toHaveBeenLastCalledWith(SECOND));
        expect(advanceQueue).toHaveBeenLastCalledWith(SESSION.id, {
            entryId: first.id,
            outcome: 'completed',
            secondsPlayed: 215,
        });
    });

    it('logs a failed video as an error', async () => {
        const first = addEntry(FIRST);
        addEntry(SECOND);
        const player = await startedStage();
        player.getCurrentTime.mockReturnValue(3.2);

        act(() => player.error(150 as YT.PlayerError));

        await waitFor(() => expect(player.loadVideoById).toHaveBeenLastCalledWith(SECOND));
        expect(advanceQueue).toHaveBeenLastCalledWith(SESSION.id, {
            entryId: first.id,
            outcome: 'error',
            secondsPlayed: 3,
        });
    });

    it('starts the first entry without logging a play', async () => {
        addEntry(FIRST);
        await startedStage();

        expect(advanceQueue).toHaveBeenCalledWith(SESSION.id, null);
    });

    it('ends the party after a second press and offers a new room', async () => {
        addEntry(FIRST);
        const player = await startedStage();

        clickButton('End party');
        clickButton('End party');

        await screen.findByRole('button', { name: 'Start' });
        expect(endSession).toHaveBeenCalledWith(SESSION.id);
        expect(player.stopVideo).toHaveBeenCalled();
        expect(window.location.search).toBe('');
    });

    it('shows an error and stays in the room when ending fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        endSession.mockRejectedValueOnce(new Error('network down'));
        addEntry(FIRST);
        await startedStage();

        clickButton('End party');
        clickButton('End party');

        expect(await screen.findByRole('alert')).toHaveTextContent('network down');
        expect(screen.getByText(SESSION.code)).toBeInTheDocument();
    });

    it('keeps the party going when ending is cancelled', async () => {
        addEntry(FIRST);
        await startedStage();

        clickButton('End party');
        clickButton('Keep singing');

        expect(endSession).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'End party' })).toBeInTheDocument();
    });

    it('offers a new room when the room in the URL has ended', async () => {
        window.history.replaceState(null, '', '/stage?room=ZZZZ');
        await renderReadyStage();

        await act(async () => {
            await findOpenSession.mock.results[0]?.value;
        });

        expect(findOpenSession).toHaveBeenCalledWith('ZZZZ');
        expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    });

    it('shows an error when the room in the URL cannot be looked up', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        findOpenSession.mockRejectedValueOnce(new Error('network down'));
        window.history.replaceState(null, '', `/stage?room=${SESSION.code}`);
        await renderReadyStage();

        expect(await screen.findByRole('alert')).toHaveTextContent('network down');
        expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    });

    it('shows an error when the queue cannot be loaded', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        fetchQueue.mockRejectedValueOnce(new Error('network down'));
        await renderReadyStage();

        clickButton('Start');

        expect(await screen.findByRole('alert')).toHaveTextContent('network down');
    });

    it('loads the queue again when the TV comes back on, not when it goes off', async () => {
        const visibility = vi.spyOn(document, 'visibilityState', 'get');
        const player = await renderReadyStage();
        clickButton('Start');
        await screen.findByRole('heading', { name: "Who's singing first?" });
        addEntry(FIRST);

        visibility.mockReturnValue('hidden');
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await act(async () => {});
        expect(player.loadVideoById).not.toHaveBeenCalled();

        visibility.mockReturnValue('visible');
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });
        await waitFor(() => expect(player.loadVideoById).toHaveBeenCalledWith(FIRST));
    });

    it('goes back to Start when the room was ended elsewhere', async () => {
        addEntry(FIRST);
        const player = await startedStage();

        closeRoom();
        act(() => notifyChange());

        await screen.findByRole('button', { name: 'Start' });
        expect(player.stopVideo).toHaveBeenCalled();
    });

    describe('idle screen', () => {
        it('shows how to join while the queue is empty', async () => {
            await renderReadyStage();
            clickButton('Start');

            expect(
                await screen.findByRole('heading', { name: "Who's singing first?" }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('img', { name: 'QR code to join this room' }),
            ).toBeInTheDocument();
            expect(screen.getByText(SESSION.code)).toBeInTheDocument();
            expect(screen.getByText(window.location.host)).toBeInTheDocument();
            // The corner badge would only repeat the big code.
            expect(screen.queryByText('Room')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'End party' })).not.toHaveFocus();
        });

        it('gets out of the way when a song is added', async () => {
            const player = await renderReadyStage();
            clickButton('Start');
            await screen.findByRole('heading', { name: "Who's singing first?" });

            addEntry(FIRST);
            act(() => notifyChange());

            await waitFor(() => expect(player.loadVideoById).toHaveBeenCalledWith(FIRST));
            expect(screen.queryByRole('heading')).not.toBeInTheDocument();
            expect(screen.getByText('Room')).toBeInTheDocument();
        });

        it('comes back asking who is next once the queue runs out', async () => {
            addEntry(FIRST);
            const player = await startedStage();

            act(() => player.stateChange(YT.PlayerState.ENDED));

            expect(await screen.findByRole('heading', { name: "Who's next?" })).toBeInTheDocument();
        });

        it('does not show before the queue has loaded', async () => {
            addEntry(FIRST);
            const player = await renderReadyStage();

            clickButton('Start');
            await screen.findByText(SESSION.code);
            expect(screen.queryByRole('heading')).not.toBeInTheDocument();

            await waitFor(() => expect(player.loadVideoById).toHaveBeenCalledWith(FIRST));
            expect(screen.queryByRole('heading')).not.toBeInTheDocument();
        });

        it('does not show between two songs', async () => {
            addEntry(FIRST);
            addEntry(SECOND);
            const player = await startedStage();

            act(() => player.stateChange(YT.PlayerState.ENDED));
            expect(screen.queryByRole('heading')).not.toBeInTheDocument();

            await waitFor(() => expect(player.loadVideoById).toHaveBeenLastCalledWith(SECOND));
            expect(screen.queryByRole('heading')).not.toBeInTheDocument();
        });

        it('says when the live connection is lost, on the idle screen too', async () => {
            subscribeToQueue.mockImplementationOnce((_sessionId, onChange, onStatus) => {
                onStatus('CHANNEL_ERROR');
                onChange();
                return () => {};
            });
            await renderReadyStage();
            clickButton('Start');

            await screen.findByRole('heading', { name: "Who's singing first?" });

            expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
        });

        it('shows the room code next to Resume after a reload', async () => {
            window.history.replaceState(null, '', `/stage?room=${SESSION.code}`);
            await renderReadyStage();

            await screen.findByRole('button', { name: 'Resume' });

            expect(screen.getByText(SESSION.code)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Resume' })).toHaveFocus();
        });
    });

    describe('remote', () => {
        it('pauses and resumes the song with OK', async () => {
            addEntry(FIRST);
            const player = await startedStage();

            press('Enter');
            expect(player.pauseVideo).toHaveBeenCalledTimes(1);
            act(() => player.stateChange(YT.PlayerState.PAUSED));
            expect(screen.getByText('Paused · press OK to resume')).toBeInTheDocument();

            press('Enter');
            expect(player.playVideo).toHaveBeenCalledTimes(1);
            act(() => player.stateChange(YT.PlayerState.PLAYING));
            expect(screen.queryByText('Paused · press OK to resume')).not.toBeInTheDocument();
        });

        it('also pauses with the play/pause key', async () => {
            addEntry(FIRST);
            const player = await startedStage();

            press('MediaPlayPause');

            expect(player.pauseVideo).toHaveBeenCalledTimes(1);
        });

        it('ignores OK while no song is playing', async () => {
            const player = await renderReadyStage();
            clickButton('Start');
            await screen.findByRole('heading', { name: "Who's singing first?" });

            press('Enter');

            expect(player.pauseVideo).not.toHaveBeenCalled();
            expect(player.playVideo).not.toHaveBeenCalled();
        });

        it('selects End party with Up, after which OK belongs to the button', async () => {
            addEntry(FIRST);
            const player = await startedStage();
            expect(screen.getByRole('button', { name: 'End party' })).not.toHaveFocus();

            press('ArrowUp');
            expect(screen.getByRole('button', { name: 'End party' })).toHaveFocus();

            press('Enter');
            expect(player.pauseVideo).not.toHaveBeenCalled();
        });

        it('deselects with Down, so OK pauses again', async () => {
            addEntry(FIRST);
            const player = await startedStage();
            press('ArrowUp');

            press('ArrowDown');
            expect(screen.getByRole('button', { name: 'End party' })).not.toHaveFocus();

            press('Enter');
            expect(player.pauseVideo).toHaveBeenCalledTimes(1);
        });

        it('moves between the two buttons of the confirmation', async () => {
            addEntry(FIRST);
            await startedStage();
            clickButton('End party');
            const keep = screen.getByRole('button', { name: 'Keep singing' });
            const end = screen.getByRole('button', { name: 'End party' });
            expect(keep).toHaveFocus();

            press('ArrowRight');
            expect(end).toHaveFocus();
            press('ArrowRight');
            expect(keep).toHaveFocus();
            press('ArrowLeft');
            expect(end).toHaveFocus();
        });

        it('leaves the selection alone on Up while a button is selected', async () => {
            addEntry(FIRST);
            await startedStage();
            clickButton('End party');
            const keep = screen.getByRole('button', { name: 'Keep singing' });

            press('ArrowUp');

            expect(keep).toHaveFocus();
        });

        it('closes the confirmation with Back', async () => {
            addEntry(FIRST);
            await startedStage();
            clickButton('End party');

            press('Escape');

            expect(screen.queryByRole('button', { name: 'Keep singing' })).not.toBeInTheDocument();
            expect(endSession).not.toHaveBeenCalled();
        });
    });

    describe('fading corner controls', () => {
        it('fades five seconds after the last press and deselects End party', async () => {
            addEntry(FIRST);
            const player = await startedStage();
            vi.useFakeTimers();
            act(() => player.stateChange(YT.PlayerState.PLAYING));
            press('ArrowUp');

            act(() => vi.advanceTimersByTime(4999));
            expect(corner()).not.toHaveClass('opacity-20');
            expect(screen.getByRole('button', { name: 'End party' })).toHaveFocus();

            act(() => vi.advanceTimersByTime(1));
            expect(corner()).toHaveClass('opacity-20');
            expect(screen.getByRole('button', { name: 'End party' })).not.toHaveFocus();

            press('ArrowDown');
            expect(corner()).not.toHaveClass('opacity-20');
        });

        it('stays lit while the song is paused', async () => {
            addEntry(FIRST);
            const player = await startedStage();
            vi.useFakeTimers();
            act(() => player.stateChange(YT.PlayerState.PLAYING));
            act(() => player.stateChange(YT.PlayerState.PAUSED));

            act(() => vi.advanceTimersByTime(5000));

            expect(corner()).not.toHaveClass('opacity-20');
        });

        it('stays lit on the idle screen but still deselects', async () => {
            await renderReadyStage();
            clickButton('Start');
            await screen.findByRole('heading', { name: "Who's singing first?" });
            vi.useFakeTimers();
            press('ArrowUp');

            act(() => vi.advanceTimersByTime(5000));

            expect(corner()).not.toHaveClass('opacity-20');
            expect(screen.getByRole('button', { name: 'End party' })).not.toHaveFocus();
        });

        it('drops the confirmation when the controls fade', async () => {
            addEntry(FIRST);
            await startedStage();
            vi.useFakeTimers();
            press('ArrowUp');
            clickButton('End party');
            expect(screen.getByRole('button', { name: 'Keep singing' })).toBeInTheDocument();

            act(() => vi.advanceTimersByTime(5000));

            expect(screen.queryByRole('button', { name: 'Keep singing' })).not.toBeInTheDocument();
            expect(endSession).not.toHaveBeenCalled();
        });

        it('leaves Start selected after the party ended', async () => {
            addEntry(FIRST);
            await startedStage();
            vi.useFakeTimers({ shouldAdvanceTime: true });
            press('ArrowUp');
            clickButton('End party');
            clickButton('End party');
            const startButton = await screen.findByRole('button', { name: 'Start' });

            act(() => vi.advanceTimersByTime(5000));

            expect(startButton).toHaveFocus();
        });
    });
});
