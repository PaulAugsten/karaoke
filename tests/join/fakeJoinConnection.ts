import { vi } from 'vitest';
import type {
    ConnectionStatus,
    QueueEntry,
    SearchResult,
    Session,
} from '@/app/join/joinConnection';

/** In-memory stand-in for app/join/joinConnection.ts. */

export const SESSION: Session = {
    id: 1,
    code: 'ABCD',
    name: null,
    started_at: '2026-01-01T00:00:00Z',
    ended_at: null,
};

const CATALOG: SearchResult[] = [
    { video_id: 'dQw4w9WgXcQ', artist: 'Rick Astley', title: 'Never Gonna Give You Up' },
    { video_id: 'fJ9rUzIMcZQ', artist: 'Queen', title: 'Bohemian Rhapsody' },
];

let entries: QueueEntry[] = [];
let notify: (() => void) | null = null;

/** Adds an entry to the fake queue. Call notifyChange to tell the page. */
export function addEntry(entry: Omit<QueueEntry, 'id' | 'status'> & Partial<QueueEntry>) {
    entries.push({ id: entries.length + 1, status: 'queued', ...entry });
}

/** Plays the part of a realtime event arriving. */
export function notifyChange() {
    notify?.();
}

export function resetFakeConnection() {
    entries = [];
    notify = null;
}

export const joinSession = vi.fn<(code: string, name: string) => Promise<Session>>(async (code) => {
    if (code.trim().toUpperCase() !== SESSION.code) {
        throw new Error(`No open room with code ${code}`);
    }
    return SESSION;
});

export const searchVideos = vi.fn<(query: string, signal: AbortSignal) => Promise<SearchResult[]>>(
    async (query) =>
        CATALOG.filter((song) =>
            `${song.artist} ${song.title}`.toLowerCase().includes(query.toLowerCase()),
        ),
);

export const enqueueVideo = vi.fn<(roomCode: string, videoId: string) => Promise<void>>(
    async () => {},
);

export const fetchQueue = vi.fn<(sessionId: number) => Promise<QueueEntry[]>>(async () =>
    entries.map((entry) => ({ ...entry })),
);

export const subscribeToQueue = vi.fn(
    (_sessionId: number, onChange: () => void, onStatus: (status: ConnectionStatus) => void) => {
        notify = onChange;
        onStatus('SUBSCRIBED');
        onChange();
        return () => {
            notify = null;
        };
    },
);
