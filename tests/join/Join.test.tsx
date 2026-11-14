import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Join } from '@/app/join/Join';
import JoinPage from '@/app/join/page';
import {
    addEntry,
    enqueueVideo,
    joinSession,
    notifyChange,
    resetFakeConnection,
    SESSION,
    searchVideos,
} from './fakeJoinConnection';

vi.mock('@/app/join/joinConnection', () => import('./fakeJoinConnection'));

/** Fills in the join form and submits it. */
function submitJoin(code: string, name = 'Sam') {
    render(<Join initialCode="" />);
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: code } });
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: name } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
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

    it('shows why joining failed and keeps the form', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        submitJoin('ZZZZ');

        expect(await screen.findByRole('alert')).toHaveTextContent('No open room with code ZZZZ');
        expect(screen.getByLabelText('Room code')).toHaveValue('ZZZZ');
        expect(screen.getByRole('button', { name: 'Join' })).toBeEnabled();
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
});
