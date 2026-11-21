import { vi } from 'vitest';
import type {
    ConnectionStatus,
    openPlayerChannel as openRealPlayerChannel,
    PlayerChannel,
    QueueEntry,
    SearchResult,
    Session,
} from '@/app/join/joinConnection';
import type { PlayerCommand, PlayerState } from '@/lib/playerState';

/** In-memory stand-in for app/join/joinConnection.ts. */

export const SESSION: Session = {
    id: 1,
    code: 'ABCD',
    name: null,
    started_at: '2026-01-01T00:00:00Z',
    ended_at: null,
    last_active_at: '2026-01-01T00:00:00Z',
};

const CATALOG: SearchResult[] = [
    { video_id: 'dQw4w9WgXcQ', artist: 'Rick Astley', title: 'Never Gonna Give You Up' },
    { video_id: 'fJ9rUzIMcZQ', artist: 'Queen', title: 'Bohemian Rhapsody' },
];

let entries: QueueEntry[] = [];
let open = true;
let notify: (() => void) | null = null;
let tvState: ((state: PlayerState) => void) | null = null;

export const sentCommands: PlayerCommand[] = [];

/** Adds an entry to the fake queue. Call notifyChange to tell the page. */
export function addEntry(entry: Omit<QueueEntry, 'id' | 'status' | 'mine'> & Partial<QueueEntry>) {
    entries.push({ id: entries.length + 1, status: 'queued', mine: false, ...entry });
}

/** Plays the part of a realtime event arriving. */
export function notifyChange() {
    notify?.();
}

/** Plays the part of the TV saying what plays over the player channel. */
export function stateFromTV(state: PlayerState) {
    tvState?.(state);
}

export function resetFakeConnection() {
    entries = [];
    open = true;
    notify = null;
    tvState = null;
    sentCommands.length = 0;
}

export const joinSession = vi.fn<(code: string, name: string) => Promise<Session>>(async (code) => {
    if (code.trim().toUpperCase() !== SESSION.code) {
        throw new Error(`No open room with code ${code}`);
    }
    return SESSION;
});

export const isSessionOpen = vi.fn<(sessionId: number) => Promise<boolean>>(async () => open);

export function closeRoom() {
    open = false;
}

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

export const removeQueueItem = vi.fn<(entryId: number) => Promise<void>>(async (entryId) => {
    entries = entries.filter((entry) => entry.id !== entryId);
});

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

export const openPlayerChannel = vi.fn(
    (_sessionId: number, handlers: Parameters<typeof openRealPlayerChannel>[1]): PlayerChannel => {
        tvState = handlers.onState ?? null;
        return {
            sendState: () => {},
            sendCommand: (command) => sentCommands.push(command),
            close: () => {
                tvState = null;
            },
        };
    },
);
