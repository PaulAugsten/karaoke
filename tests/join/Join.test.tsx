import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Join } from '@/app/join/Join';
import JoinPage from '@/app/join/page';
import {
    addEntry,
    closeRoom,
    enqueueVideo,
    joinSession,
    notifyChange,
    removeQueueItem,
    resetFakeConnection,
    SESSION,
    searchVideos,
    sentCommands,
    stateFromTV,
    subscribeToQueue,
} from './fakeJoinConnection';

vi.mock('@/app/join/joinConnection', () => import('./fakeJoinConnection'));

/** Fills in the join form and submits it. */
function submitJoin(code: string, name = 'Sam') {
    render(<Join initialCode="" />);
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: code } });
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: name } });
    fireEvent.click(screen.getByRole('button', { name: 'Join the room' }));
}

/** Joins the fake session and returns the search box. */
async function joinedSearchBox() {
    submitJoin(SESSION.code);
    return screen.findByRole('searchbox', { name: 'Search songs' });
}

/** Joins with Africa playing (entry 1) and returns the queue. */
async function joinedWithSongPlaying() {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    addEntry({ title: 'Africa', artist: 'Toto', singer: 'Sam', status: 'playing' });
    submitJoin(SESSION.code);
    const queue = await screen.findByRole('region', { name: 'Queue' });
    await within(queue).findByText('Africa');
    return queue;
}

const AFRICA = 1;

describe('Join', () => {
    afterEach(() => {
        resetFakeConnection();
        vi.clearAllMocks();
        vi.restoreAllMocks();
        vi.useRealTimers();
        localStorage.clear();
        window.history.replaceState(null, '', '/');
    });

    it('puts the cursor in the name field when the link brought the code', async () => {
        render(await JoinPage({ searchParams: Promise.resolve({ room: 'ABCD' }) }));
        expect(screen.getByRole('heading', { level: 1, name: 'Almost in.' })).toBeInTheDocument();
        expect(screen.getByLabelText('Your name')).toHaveFocus();
    });

    it('leaves the cursor alone when there is no code yet', () => {
        render(<Join initialCode="" />);
        expect(screen.getByLabelText('Your name')).not.toHaveFocus();
    });

    it('prefills the room code from the link', async () => {
        render(await JoinPage({ searchParams: Promise.resolve({ room: 'ABCD' }) }));
        expect(screen.getByLabelText('Room code')).toHaveValue('ABCD');
    });

    it('fills in the name used last time', () => {
        localStorage.setItem('karaoke:singer-name', 'Sam');
        render(<Join initialCode="" />);
        expect(screen.getByLabelText('Your name')).toHaveValue('Sam');
    });

    it('joins the room, remembers the name and puts the code in the URL', async () => {
        submitJoin('ABCD', '  Sam ');

        expect(await screen.findByRole('heading', { name: 'Room ABCD' })).toBeInTheDocument();
        expect(joinSession).toHaveBeenCalledWith('ABCD', 'Sam');
        expect(localStorage.getItem('karaoke:singer-name')).toBe('Sam');
        expect(window.location.search).toBe('?room=ABCD');
    });

    it('joins with a code typed in lowercase', async () => {
        submitJoin('abcd');

        expect(await screen.findByRole('heading', { name: 'Room ABCD' })).toBeInTheDocument();
        expect(joinSession).toHaveBeenCalledWith('abcd', 'Sam');
    });

    it('shows why joining failed and keeps the form', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        submitJoin('ZZZZ');

        expect(await screen.findByRole('alert')).toHaveTextContent('No open room with code ZZZZ');
        expect(screen.getByLabelText('Room code')).toHaveValue('ZZZZ');
        expect(screen.getByRole('button', { name: 'Join the room' })).toBeEnabled();
    });

    it('searches once typing pauses', async () => {
        const box = await joinedSearchBox();
        for (const value of ['r', 'ri', 'ric', 'rick']) {
            fireEvent.change(box, { target: { value } });
        }

        await screen.findByRole('button', { name: /Never Gonna Give You Up/ });
        expect(searchVideos).toHaveBeenCalledTimes(1);
        expect(searchVideos).toHaveBeenCalledWith('rick', expect.anything());
    });

    it('adds a tapped result to the queue', async () => {
        const box = await joinedSearchBox();
        fireEvent.change(box, { target: { value: 'queen' } });
        const result = await screen.findByRole('button', { name: /Bohemian Rhapsody/ });

        fireEvent.click(result);

        await waitFor(() => expect(result).toBeDisabled());
        expect(result).toHaveTextContent('Added');
        expect(enqueueVideo).toHaveBeenCalledWith('ABCD', 'fJ9rUzIMcZQ');
    });

    it('says when nothing matches', async () => {
        const box = await joinedSearchBox();
        fireEvent.change(box, { target: { value: 'zzz' } });
        expect(await screen.findByText('No songs found')).toBeInTheDocument();
    });

    it('closes the results on Escape and brings them back on typing', async () => {
        const box = await joinedSearchBox();
        fireEvent.change(box, { target: { value: 'queen' } });
        await screen.findByRole('button', { name: /Bohemian Rhapsody/ });

        fireEvent.keyDown(box, { key: 'Escape' });

        expect(screen.queryByRole('button', { name: /Bohemian Rhapsody/ })).not.toBeInTheDocument();
        expect(box).toHaveValue('queen');

        fireEvent.change(box, { target: { value: 'queen ' } });

        expect(screen.getByRole('button', { name: /Bohemian Rhapsody/ })).toBeInTheDocument();
    });

    it('closes the results on Escape after a song was tapped', async () => {
        const box = await joinedSearchBox();
        fireEvent.change(box, { target: { value: 'queen' } });
        const result = await screen.findByRole('button', { name: /Bohemian Rhapsody/ });
        fireEvent.click(result);
        await waitFor(() => expect(result).toBeDisabled());

        fireEvent.keyDown(result, { key: 'Escape' });

        expect(screen.queryByRole('button', { name: /Bohemian Rhapsody/ })).not.toBeInTheDocument();
    });

    it('closes the results on a tap outside and brings them back on focus', async () => {
        const box = await joinedSearchBox();
        fireEvent.change(box, { target: { value: 'queen' } });
        await screen.findByRole('button', { name: /Bohemian Rhapsody/ });

        fireEvent.click(screen.getByRole('button', { name: 'Close search results' }));

        expect(screen.queryByRole('button', { name: /Bohemian Rhapsody/ })).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Close search results' }),
        ).not.toBeInTheDocument();

        fireEvent.focus(box);

        expect(screen.getByRole('button', { name: /Bohemian Rhapsody/ })).toBeInTheDocument();
    });

    it('keeps the queue in the page while results are showing', async () => {
        addEntry({ title: 'Africa', artist: 'Toto', singer: 'Sam' });
        const box = await joinedSearchBox();
        fireEvent.change(box, { target: { value: 'queen' } });
        await screen.findByRole('button', { name: /Bohemian Rhapsody/ });

        const queue = screen.getByRole('region', { name: 'Queue' });
        expect(await within(queue).findByText('Africa')).toBeInTheDocument();
    });

    it('numbers the waiting songs and counts the whole queue', async () => {
        addEntry({
            title: 'Mr. Brightside',
            artist: 'The Killers',
            singer: 'Jo',
            status: 'playing',
        });
        addEntry({ title: 'Wonderwall', artist: 'Oasis', singer: 'Lena' });
        addEntry({ title: 'Shallow', artist: 'Lady Gaga', singer: 'Mia' });
        submitJoin(SESSION.code);

        const queue = await screen.findByRole('region', { name: 'Queue' });
        expect(await within(queue).findByText('3 songs')).toBeInTheDocument();
        expect(
            within(queue)
                .getAllByRole('listitem')
                .map((item) => item.textContent),
        ).toEqual(['1WonderwallOasis · Lena', '2ShallowLady Gaga · Mia']);
    });

    it('counts a single song without the plural', async () => {
        addEntry({ title: 'Wonderwall', artist: 'Oasis', singer: 'Lena' });
        submitJoin(SESSION.code);

        const queue = await screen.findByRole('region', { name: 'Queue' });
        expect(await within(queue).findByText('1 song')).toBeInTheDocument();
    });

    it('shows the queue and updates it live', async () => {
        addEntry({
            title: 'Never Gonna Give You Up',
            artist: 'Rick Astley',
            singer: 'Sam',
            status: 'playing',
        });
        addEntry({ title: 'Bohemian Rhapsody', artist: 'Queen', singer: 'Alex' });
        submitJoin(SESSION.code);

        const queue = await screen.findByRole('region', { name: 'Queue' });
        expect(await within(queue).findByText('Never Gonna Give You Up')).toBeInTheDocument();
        expect(within(queue).getByText('Now singing')).toBeInTheDocument();
        expect(within(queue).getByText('Queen · Alex')).toBeInTheDocument();

        addEntry({ title: 'Africa', artist: 'Toto', singer: 'Sam' });
        act(() => notifyChange());

        expect(await within(queue).findByText('Africa')).toBeInTheDocument();
    });

    it('says when the live connection is lost instead of counting songs', async () => {
        subscribeToQueue.mockImplementationOnce((_sessionId, onChange, onStatus) => {
            onStatus('CHANNEL_ERROR');
            onChange();
            return () => {};
        });
        addEntry({ title: 'Wonderwall', artist: 'Oasis', singer: 'Lena' });
        submitJoin(SESSION.code);

        const queue = await screen.findByRole('region', { name: 'Queue' });
        expect(await within(queue).findByText('Wonderwall')).toBeInTheDocument();
        expect(within(queue).getByText('Reconnecting...')).toBeInTheDocument();
        expect(within(queue).queryByText('1 song')).not.toBeInTheDocument();
    });

    it('returns to the form when the room ends', async () => {
        await joinedSearchBox();

        closeRoom();
        act(() => notifyChange());

        expect(await screen.findByRole('alert')).toHaveTextContent('This party has ended.');
        expect(screen.getByRole('button', { name: 'Join the room' })).toBeInTheDocument();
    });

    describe('now singing', () => {
        it('shows how far the song on the TV is and counts on between messages', async () => {
            const queue = await joinedWithSongPlaying();

            act(() => stateFromTV({ entryId: AFRICA, position: 61, duration: 238, paused: false }));
            const bar = within(queue).getByRole('slider', { name: 'Song position' });
            expect(bar).toHaveValue('61');
            expect(bar).toHaveAttribute('aria-valuetext', '1:01 of 3:58');
            expect(within(queue).getByText('3:58')).toBeInTheDocument();

            // The phone counts on in steps of a quarter second.
            act(() => vi.advanceTimersByTime(2250));
            expect(bar).toHaveValue('63');
            expect(within(queue).getByText('1:03')).toBeInTheDocument();
        });

        it('stands still while the TV is paused and offers Play', async () => {
            const queue = await joinedWithSongPlaying();

            act(() => stateFromTV({ entryId: AFRICA, position: 61, duration: 238, paused: true }));
            act(() => vi.advanceTimersByTime(2000));

            expect(within(queue).getByRole('slider', { name: 'Song position' })).toHaveValue('61');
            expect(within(queue).getByRole('button', { name: 'Play' })).toBeEnabled();
        });

        it('waits for the TV until it says something', async () => {
            const queue = await joinedWithSongPlaying();

            expect(within(queue).getByText('Waiting for the TV...')).toBeInTheDocument();
            expect(within(queue).getByRole('slider', { name: 'Song position' })).toBeDisabled();
            for (const name of ['-10', 'Pause', '+10', 'Skip']) {
                expect(within(queue).getByRole('button', { name })).toBeDisabled();
            }
        });

        it('ignores a time that belongs to another song', async () => {
            const queue = await joinedWithSongPlaying();

            act(() => stateFromTV({ entryId: 99, position: 61, duration: 238, paused: false }));

            expect(within(queue).getByText('Waiting for the TV...')).toBeInTheDocument();
            expect(within(queue).queryByText('3:58')).not.toBeInTheDocument();
        });

        it('stops showing a time after ten seconds without a word from the TV', async () => {
            const queue = await joinedWithSongPlaying();
            act(() => stateFromTV({ entryId: AFRICA, position: 61, duration: 238, paused: false }));

            act(() => vi.advanceTimersByTime(9500));
            expect(within(queue).queryByText('Waiting for the TV...')).not.toBeInTheDocument();

            act(() => vi.advanceTimersByTime(1000));
            expect(within(queue).getByText('Waiting for the TV...')).toBeInTheDocument();
            expect(within(queue).getByRole('button', { name: 'Skip' })).toBeDisabled();
        });

        it('keeps the jumps off until the TV knows the length', async () => {
            const queue = await joinedWithSongPlaying();

            act(() => stateFromTV({ entryId: AFRICA, position: 0, duration: 0, paused: false }));

            expect(within(queue).getByRole('button', { name: '+10' })).toBeDisabled();
            expect(within(queue).getByRole('slider', { name: 'Song position' })).toBeDisabled();
            expect(within(queue).getByRole('button', { name: 'Pause' })).toBeEnabled();
            expect(within(queue).getByRole('button', { name: 'Skip' })).toBeEnabled();
        });

        it('asks the TV to pause, play, jump and skip, naming the song', async () => {
            const queue = await joinedWithSongPlaying();
            act(() => stateFromTV({ entryId: AFRICA, position: 61, duration: 238, paused: false }));

            fireEvent.click(within(queue).getByRole('button', { name: 'Pause' }));
            // Shown at once, before the TV confirms it.
            fireEvent.click(within(queue).getByRole('button', { name: 'Play' }));
            fireEvent.click(within(queue).getByRole('button', { name: '+10' }));
            fireEvent.click(within(queue).getByRole('button', { name: '-10' }));
            fireEvent.click(within(queue).getByRole('button', { name: 'Skip' }));

            expect(sentCommands).toEqual([
                { action: 'pause', entryId: AFRICA },
                { action: 'play', entryId: AFRICA },
                { action: 'seekBy', entryId: AFRICA, seconds: 10 },
                { action: 'seekBy', entryId: AFRICA, seconds: -10 },
                { action: 'skip', entryId: AFRICA },
            ]);
        });

        it('shows a jump at once, before the TV confirms it', async () => {
            const queue = await joinedWithSongPlaying();
            act(() => stateFromTV({ entryId: AFRICA, position: 61, duration: 238, paused: true }));

            fireEvent.click(within(queue).getByRole('button', { name: '+10' }));

            expect(within(queue).getByRole('slider', { name: 'Song position' })).toHaveValue('71');
        });

        it('jumps when the bar is let go, not while it is dragged', async () => {
            const queue = await joinedWithSongPlaying();
            act(() => stateFromTV({ entryId: AFRICA, position: 61, duration: 238, paused: true }));
            const bar = within(queue).getByRole('slider', { name: 'Song position' });

            fireEvent.input(bar, { target: { value: '120' } });
            expect(sentCommands).toEqual([]);
            expect(within(queue).getByText('2:00')).toBeInTheDocument();

            fireEvent.change(bar);
            expect(sentCommands).toEqual([{ action: 'seekTo', entryId: AFRICA, seconds: 120 }]);
            expect(bar).toHaveValue('120');
        });
    });

    describe('removing your own song', () => {
        it('is offered on your own waiting songs only', async () => {
            addEntry({
                title: 'Africa',
                artist: 'Toto',
                singer: 'Sam',
                status: 'playing',
                mine: true,
            });
            addEntry({ title: 'Wonderwall', artist: 'Oasis', singer: 'Sam', mine: true });
            addEntry({ title: 'Shallow', artist: 'Lady Gaga', singer: 'Mia' });
            submitJoin(SESSION.code);

            const queue = await screen.findByRole('region', { name: 'Queue' });
            await within(queue).findByText('Wonderwall');
            expect(
                within(queue)
                    .getAllByRole('button', { name: /^Remove/ })
                    .map((button) => button.getAttribute('aria-label')),
            ).toEqual(['Remove Wonderwall']);
        });

        it('takes the song out of the queue', async () => {
            addEntry({ title: 'Wonderwall', artist: 'Oasis', singer: 'Sam', mine: true });
            addEntry({ title: 'Shallow', artist: 'Lady Gaga', singer: 'Mia' });
            submitJoin(SESSION.code);
            const queue = await screen.findByRole('region', { name: 'Queue' });

            fireEvent.click(
                await within(queue).findByRole('button', { name: 'Remove Wonderwall' }),
            );
            await waitFor(() => expect(removeQueueItem).toHaveBeenCalledWith(1));
            act(() => notifyChange());

            await waitFor(() =>
                expect(within(queue).queryByText('Wonderwall')).not.toBeInTheDocument(),
            );
            expect(within(queue).getByText('Shallow')).toBeInTheDocument();
        });

        it('says why a song could not be removed and lets you try again', async () => {
            removeQueueItem.mockRejectedValueOnce(new Error('This song has already started'));
            addEntry({ title: 'Wonderwall', artist: 'Oasis', singer: 'Sam', mine: true });
            submitJoin(SESSION.code);
            const queue = await screen.findByRole('region', { name: 'Queue' });

            fireEvent.click(
                await within(queue).findByRole('button', { name: 'Remove Wonderwall' }),
            );

            expect(await within(queue).findByRole('alert')).toHaveTextContent(
                'This song has already started',
            );
            expect(within(queue).getByRole('button', { name: 'Remove Wonderwall' })).toBeEnabled();
        });

        it('cannot be pressed twice while the first press is on its way', async () => {
            removeQueueItem.mockReturnValueOnce(new Promise(() => {}));
            addEntry({ title: 'Wonderwall', artist: 'Oasis', singer: 'Sam', mine: true });
            submitJoin(SESSION.code);
            const queue = await screen.findByRole('region', { name: 'Queue' });

            const button = await within(queue).findByRole('button', { name: 'Remove Wonderwall' });
            fireEvent.click(button);

            await waitFor(() => expect(button).toBeDisabled());
        });
    });
});
