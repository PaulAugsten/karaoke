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
    resetFakeConnection,
    SESSION,
    searchVideos,
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

describe('Join', () => {
    afterEach(() => {
        resetFakeConnection();
        vi.clearAllMocks();
        vi.restoreAllMocks();
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
});
