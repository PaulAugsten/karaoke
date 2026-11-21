import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StagePage from '@/app/stage/page';
import {
    addEntry,
    advanceQueue,
    closePlayerChannel,
    closeRoom,
    commandFromPhone,
    createSession,
    endSession,
    fetchQueue,
    findOpenSession,
    notifyChange,
    openPlayerChannel,
    reportUnplayable,
    resetFakeConnection,
    SESSION,
    sentStates,
    subscribeToQueue,
} from './fakeStageConnection';
import { type FakePlayer, installFakeYouTube, latestPlayer, resetFakeYouTube } from './fakeYouTube';

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

function bar() {
    return progress().parentElement!;
}

function progress() {
    return screen.getByRole('progressbar', { name: 'Song progress' });
}

function skipButton() {
    return screen.getByRole('button', { name: 'Skip' });
}

/** Sets what the player answers when asked for its time, in seconds. */
function setClock(player: FakePlayer, position: number, duration: number) {
    player.getCurrentTime.mockReturnValue(position);
    player.getDuration.mockReturnValue(duration);
}

/** Lets the stage read the player's time once. */
function tick() {
    act(() => vi.advanceTimersByTime(250));
}

/** Renders the stage, presses Start and waits until the first video loads. */
async function startedStage() {
    const player = await renderReadyStage();
    clickButton('Start');
    await waitFor(() => expect(player.loadVideoById).toHaveBeenCalledWith(FIRST));
    return player;
}

/**
 * Like startedStage, then YouTube says the first song plays, with its clock as given. Timers
 * are fake, but still run with real time so that waitFor works.
 */
async function playingStage(position: number, duration: number) {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const player = await startedStage();
    setClock(player, position, duration);
    act(() => player.stateChange(YT.PlayerState.PLAYING));
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
            expect(screen.getByText('Paused')).toBeInTheDocument();
            expect(screen.getByText('Press OK to resume')).toBeInTheDocument();

            press('Enter');
            expect(player.playVideo).toHaveBeenCalledTimes(1);
            act(() => player.stateChange(YT.PlayerState.PLAYING));
            expect(screen.queryByText('Paused')).not.toBeInTheDocument();
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

        it('moves between the two buttons of the confirmation, without seeking', async () => {
            addEntry(FIRST);
            const player = await startedStage();
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
            expect(player.seekTo).not.toHaveBeenCalled();
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

    describe('controls during a song', () => {
        it('hide five seconds after the last press and deselects End party', async () => {
            addEntry(FIRST);
            const player = await startedStage();
            vi.useFakeTimers();
            act(() => player.stateChange(YT.PlayerState.PLAYING));
            press('ArrowUp');

            act(() => vi.advanceTimersByTime(4999));
            expect(corner()).not.toHaveClass('opacity-0');
            expect(bar()).not.toHaveClass('opacity-0');
            expect(screen.getByRole('button', { name: 'End party' })).toHaveFocus();

            act(() => vi.advanceTimersByTime(1));
            expect(corner()).toHaveClass('opacity-0');
            expect(bar()).toHaveClass('opacity-0');
            expect(screen.getByRole('button', { name: 'End party' })).not.toHaveFocus();

            fireEvent.pointerMove(document);
            expect(corner()).not.toHaveClass('opacity-0');
            expect(bar()).not.toHaveClass('opacity-0');
        });

        it('never hide the room code, so latecomers can still join', async () => {
            addEntry(FIRST);
            const player = await startedStage();
            vi.useFakeTimers();
            act(() => player.stateChange(YT.PlayerState.PLAYING));

            act(() => vi.advanceTimersByTime(5000));

            expect(corner()).toHaveClass('opacity-0');
            expect(screen.getByText('Room').parentElement).not.toHaveClass('opacity-0');
            expect(screen.getByText(SESSION.code)).toBeInTheDocument();
        });

        it('stay on screen while the song is paused', async () => {
            addEntry(FIRST);
            const player = await startedStage();
            vi.useFakeTimers();
            act(() => player.stateChange(YT.PlayerState.PLAYING));
            act(() => player.stateChange(YT.PlayerState.PAUSED));

            act(() => vi.advanceTimersByTime(5000));

            expect(corner()).not.toHaveClass('opacity-0');
            expect(bar()).not.toHaveClass('opacity-0');
        });

        it('stay on screen on the idle screen but still deselects', async () => {
            await renderReadyStage();
            clickButton('Start');
            await screen.findByRole('heading', { name: "Who's singing first?" });
            vi.useFakeTimers();
            press('ArrowUp');

            act(() => vi.advanceTimersByTime(5000));

            expect(corner()).not.toHaveClass('opacity-0');
            expect(screen.getByRole('button', { name: 'End party' })).not.toHaveFocus();
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
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

        describe('progress bar', () => {
            it('shows how far the song is', async () => {
                addEntry(FIRST);
                await playingStage(61, 238);

                tick();

                expect(progress()).toHaveAttribute('aria-valuetext', '1:01 of 3:58');
                expect(screen.getByText('1:01')).toBeInTheDocument();
                expect(screen.getByText('3:58')).toBeInTheDocument();
            });

            it('shows no time until YouTube knows the length', async () => {
                addEntry(FIRST);
                await playingStage(0, 0);

                tick();

                expect(progress()).not.toHaveAttribute('aria-valuetext');
                expect(screen.getAllByText('-:--')).toHaveLength(2);
            });

            it('starts over at zero for the next song', async () => {
                addEntry(FIRST);
                addEntry(SECOND);
                const player = await playingStage(61, 238);
                tick();

                clickButton('Skip');

                await waitFor(() => expect(player.loadVideoById).toHaveBeenLastCalledWith(SECOND));
                expect(progress()).toHaveAttribute('aria-valuenow', '0');
            });
        });

        describe('end of a song', () => {
            it('moves on a second before the video ends, so YouTube shows no end screen', async () => {
                const first = addEntry(FIRST);
                addEntry(SECOND);
                const player = await playingStage(198.9, 200);
                const callsBefore = advanceQueue.mock.calls.length;
                tick();
                expect(advanceQueue).toHaveBeenCalledTimes(callsBefore);

                setClock(player, 199, 200);
                tick();

                await waitFor(() => expect(player.loadVideoById).toHaveBeenLastCalledWith(SECOND));
                expect(advanceQueue).toHaveBeenLastCalledWith(SESSION.id, {
                    entryId: first.id,
                    outcome: 'completed',
                    secondsPlayed: 199,
                });
            });

            it("does not take the last song's time for the next one before it starts", async () => {
                addEntry(FIRST);
                const second = addEntry(SECOND);
                addEntry(THIRD);
                const player = await playingStage(199.5, 200);
                tick();
                await waitFor(() => expect(player.loadVideoById).toHaveBeenLastCalledWith(SECOND));

                // YouTube still answers with the old video's time until the new one plays.
                act(() => vi.advanceTimersByTime(1000));
                await act(async () => {});

                expect(advanceQueue).not.toHaveBeenCalledWith(
                    SESSION.id,
                    expect.objectContaining({ entryId: second.id }),
                );
                expect(progress()).toHaveAttribute('aria-valuenow', '0');
                expect(skipButton()).not.toHaveFocus();
            });

            it('asks to move on once while the next song is on its way', async () => {
                addEntry(FIRST);
                addEntry(SECOND);
                const player = await playingStage(199.5, 200);
                const callsBefore = advanceQueue.mock.calls.length;
                fetchQueue.mockReturnValueOnce(new Promise(() => {})); // the next song never arrives

                tick();
                await act(async () => {});
                tick();
                act(() => player.stateChange(YT.PlayerState.ENDED));
                tick();
                await act(async () => {});

                expect(advanceQueue).toHaveBeenCalledTimes(callsBefore + 1);
            });

            it('does not move on while paused in the last second', async () => {
                addEntry(FIRST);
                const player = await playingStage(199.5, 200);
                const callsBefore = advanceQueue.mock.calls.length;
                act(() => player.stateChange(YT.PlayerState.PAUSED));

                act(() => vi.advanceTimersByTime(1000));

                expect(advanceQueue).toHaveBeenCalledTimes(callsBefore);
            });

            it('selects Skip for the last 20 seconds and keeps it while the controls sleep', async () => {
                addEntry(FIRST);
                const player = await playingStage(179, 200);
                tick();
                expect(skipButton()).not.toHaveFocus();

                setClock(player, 180, 200);
                tick();
                expect(skipButton()).toHaveFocus();

                act(() => vi.advanceTimersByTime(5000));
                expect(skipButton()).toHaveFocus();
                expect(bar()).not.toHaveClass('opacity-0');
                expect(corner()).toHaveClass('opacity-0');
            });

            it('leaves Skip alone after Back in the last 20 seconds', async () => {
                addEntry(FIRST);
                await playingStage(185, 200);
                tick();
                expect(skipButton()).toHaveFocus();

                press('Escape');
                tick();

                expect(skipButton()).not.toHaveFocus();
            });

            it('still seeks with Left and Right while Skip is selected', async () => {
                addEntry(FIRST);
                const player = await playingStage(185, 200);
                tick();
                expect(skipButton()).toHaveFocus();

                press('ArrowLeft');

                expect(player.seekTo).toHaveBeenLastCalledWith(175, true);
            });

            it('does not carry a selected Skip over to the next song', async () => {
                addEntry(FIRST);
                addEntry(SECOND);
                const player = await playingStage(185, 200);
                tick();
                expect(skipButton()).toHaveFocus();

                setClock(player, 199.2, 200);
                tick();

                await waitFor(() => expect(player.loadVideoById).toHaveBeenLastCalledWith(SECOND));
                expect(skipButton()).not.toHaveFocus();
            });
        });

        describe('seeking', () => {
            it('jumps ten seconds back and ahead with Left and Right', async () => {
                addEntry(FIRST);
                const player = await playingStage(50, 200);

                press('ArrowRight');
                expect(player.seekTo).toHaveBeenLastCalledWith(60, true);
                expect(progress()).toHaveAttribute('aria-valuetext', '1:00 of 3:20');

                press('ArrowLeft');
                expect(player.seekTo).toHaveBeenLastCalledWith(50, true);
            });

            it('adds up quick presses, although YouTube reports the old time for a moment', async () => {
                addEntry(FIRST);
                // The fake keeps answering 50 after every jump, as YouTube does right after one.
                const player = await playingStage(50, 200);

                press('ArrowRight');
                press('ArrowRight');
                press('ArrowRight');
                tick();

                expect(player.seekTo.mock.calls.map(([seconds]) => seconds)).toEqual([60, 70, 80]);
                expect(progress()).toHaveAttribute('aria-valuenow', '80');
            });

            it('believes YouTube again a second after a jump it did not follow', async () => {
                addEntry(FIRST);
                const player = await playingStage(50, 200);
                press('ArrowRight');

                act(() => vi.advanceTimersByTime(1250));

                expect(progress()).toHaveAttribute('aria-valuenow', '50');
                press('ArrowRight');
                expect(player.seekTo).toHaveBeenLastCalledWith(60, true);
            });

            it('also jumps with the Rewind and Fast forward keys', async () => {
                addEntry(FIRST);
                const player = await playingStage(50, 200);

                press('MediaFastForward');
                expect(player.seekTo).toHaveBeenLastCalledWith(60, true);

                press('MediaRewind');
                expect(player.seekTo).toHaveBeenLastCalledWith(50, true);
            });

            it('stays inside the song', async () => {
                addEntry(FIRST);
                const player = await playingStage(195, 200);

                press('ArrowRight');
                expect(player.seekTo).toHaveBeenLastCalledWith(198, true);

                setClock(player, 198, 200); // YouTube got there
                tick();
                press('Escape'); // Skip was selected for the last seconds
                setClock(player, 4, 200);
                press('ArrowLeft');
                expect(player.seekTo).toHaveBeenLastCalledWith(0, true);
            });

            it('waits until YouTube knows the length', async () => {
                addEntry(FIRST);
                const player = await playingStage(0, 0);

                press('ArrowRight');

                expect(player.seekTo).not.toHaveBeenCalled();
            });

            it('does nothing while no song is playing', async () => {
                const player = await renderReadyStage();
                clickButton('Start');
                await screen.findByRole('heading', { name: "Who's singing first?" });

                press('ArrowRight');

                expect(player.seekTo).not.toHaveBeenCalled();
            });
        });

        describe('skip', () => {
            it('is selected with Down and logs the song as skipped', async () => {
                const first = addEntry(FIRST);
                addEntry(SECOND);
                const player = await startedStage();
                player.getCurrentTime.mockReturnValue(42.4);

                press('ArrowDown');
                expect(skipButton()).toHaveFocus();
                clickButton('Skip');

                await waitFor(() => expect(player.loadVideoById).toHaveBeenLastCalledWith(SECOND));
                expect(advanceQueue).toHaveBeenLastCalledWith(SESSION.id, {
                    entryId: first.id,
                    outcome: 'skipped',
                    secondsPlayed: 42,
                });
                expect(skipButton()).not.toHaveFocus();
            });

            it('skips one song when pressed twice before the next one arrives', async () => {
                addEntry(FIRST);
                addEntry(SECOND);
                addEntry(THIRD);
                const player = await startedStage();

                clickButton('Skip');
                clickButton('Skip');

                await waitFor(() => expect(player.loadVideoById).toHaveBeenLastCalledWith(SECOND));
                expect(player.loadVideoById).not.toHaveBeenCalledWith(THIRD);
            });

            it('goes back to nothing selected with Up, and to End party with another Up', async () => {
                addEntry(FIRST);
                const player = await startedStage();
                press('ArrowDown');

                press('ArrowUp');
                expect(document.body).toHaveFocus();
                press('Enter');
                expect(player.pauseVideo).toHaveBeenCalledTimes(1);

                press('ArrowUp');
                expect(screen.getByRole('button', { name: 'End party' })).toHaveFocus();
            });

            it('shows the idle screen when the last song is skipped', async () => {
                addEntry(FIRST);
                await startedStage();

                clickButton('Skip');

                expect(
                    await screen.findByRole('heading', { name: "Who's next?" }),
                ).toBeInTheDocument();
                expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
            });
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

    describe('phone remote', () => {
        it('tells the phones what plays and that it is paused', async () => {
            const first = addEntry(FIRST);
            const player = await playingStage(61, 238);
            tick();

            act(() => player.stateChange(YT.PlayerState.PAUSED));

            expect(sentStates.at(-1)).toEqual({
                entryId: first.id,
                position: 61,
                duration: 238,
                paused: true,
            });
        });

        it('says so at once after a jump, without waiting three seconds', async () => {
            const first = addEntry(FIRST);
            await playingStage(61, 238);
            tick();

            press('ArrowRight');

            expect(sentStates.at(-1)).toEqual({
                entryId: first.id,
                position: 71,
                duration: 238,
                paused: false,
            });
        });

        it('says nothing is playing once the queue is empty', async () => {
            addEntry(FIRST);
            await playingStage(61, 238);

            clickButton('Skip');

            await waitFor(() =>
                expect(sentStates.at(-1)).toEqual({
                    entryId: null,
                    position: 0,
                    duration: 0,
                    paused: false,
                }),
            );
        });

        it('pauses and plays for a phone', async () => {
            const first = addEntry(FIRST);
            const player = await playingStage(61, 238);

            act(() => commandFromPhone({ action: 'pause', entryId: first.id }));
            expect(player.pauseVideo).toHaveBeenCalledTimes(1);
            act(() => player.stateChange(YT.PlayerState.PAUSED));

            act(() => commandFromPhone({ action: 'pause', entryId: first.id }));
            expect(player.pauseVideo).toHaveBeenCalledTimes(1); // already paused
            act(() => commandFromPhone({ action: 'play', entryId: first.id }));
            expect(player.playVideo).toHaveBeenCalledTimes(1);
        });

        it('jumps for a phone, by ten seconds or to a point, inside the song', async () => {
            const first = addEntry(FIRST);
            const player = await playingStage(61, 238);

            act(() => commandFromPhone({ action: 'seekBy', entryId: first.id, seconds: -10 }));
            expect(player.seekTo).toHaveBeenLastCalledWith(51, true);

            act(() => commandFromPhone({ action: 'seekTo', entryId: first.id, seconds: 120 }));
            expect(player.seekTo).toHaveBeenLastCalledWith(120, true);

            act(() => commandFromPhone({ action: 'seekTo', entryId: first.id, seconds: 999 }));
            expect(player.seekTo).toHaveBeenLastCalledWith(236, true);
        });

        it('skips for a phone and logs it as skipped', async () => {
            const first = addEntry(FIRST);
            addEntry(SECOND);
            const player = await playingStage(42, 238);

            act(() => commandFromPhone({ action: 'skip', entryId: first.id }));

            await waitFor(() => expect(player.loadVideoById).toHaveBeenLastCalledWith(SECOND));
            expect(advanceQueue).toHaveBeenLastCalledWith(SESSION.id, {
                entryId: first.id,
                outcome: 'skipped',
                secondsPlayed: 42,
            });
        });

        it('ignores a command meant for a song that is no longer playing', async () => {
            const first = addEntry(FIRST);
            addEntry(SECOND);
            addEntry(THIRD);
            const player = await playingStage(61, 238);
            const callsBefore = advanceQueue.mock.calls.length;

            act(() => commandFromPhone({ action: 'skip', entryId: first.id + 1 }));
            act(() => commandFromPhone({ action: 'seekBy', entryId: 999, seconds: 10 }));
            act(() => commandFromPhone({ action: 'pause', entryId: 999 }));

            expect(advanceQueue).toHaveBeenCalledTimes(callsBefore);
            expect(player.seekTo).not.toHaveBeenCalled();
            expect(player.pauseVideo).not.toHaveBeenCalled();
        });

        it('only listens to phones while the room is on screen', async () => {
            window.history.replaceState(null, '', `/stage?room=${SESSION.code}`);
            await renderReadyStage();
            await screen.findByRole('button', { name: 'Resume' });
            expect(openPlayerChannel).not.toHaveBeenCalled();

            clickButton('Resume');
            await screen.findByRole('heading', { name: "Who's singing first?" });
            expect(openPlayerChannel).toHaveBeenCalledWith(SESSION.id, expect.anything());

            clickButton('End party');
            clickButton('End party');
            await waitFor(() => expect(closePlayerChannel).toHaveBeenCalledTimes(1));
            expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
        });
    });
});
