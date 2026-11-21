import { vi } from 'vitest';
import type {
    ConnectionStatus,
    FinishedPlay,
    openPlayerChannel as openRealPlayerChannel,
    PlayerChannel,
    QueueItem,
    Session,
} from '@/app/stage/stageConnection';
import type { PlayerCommand, PlayerState } from '@/lib/playerState';

/**
 * In-memory stand-in for app/stage/stageConnection.ts. advanceQueue mirrors the
 * advance_queue database function, so the stage can be tested end to end.
 */

export const SESSION: Session = {
    id: 1,
    code: 'ABCD',
    name: null,
    started_at: '2026-01-01T00:00:00Z',
    ended_at: null,
    last_active_at: '2026-01-01T00:00:00Z',
};

let open = true;
let entries: QueueItem[] = [];
let notify: (() => void) | null = null;
let phoneCommand: ((command: PlayerCommand) => void) | null = null;

export const sentStates: PlayerState[] = [];

/** Adds an entry to the fake database. Call `notifyChange` to tell the stage. */
export function addEntry(videoId: string, status: QueueItem['status'] = 'queued'): QueueItem {
    const id = entries.length + 1;
    const entry: QueueItem = {
        id,
        session_id: SESSION.id,
        video_id: videoId,
        status,
        position: id,
        singer_id: null,
        added_at: '2026-01-01T00:00:00Z',
        picked_by: 'queue',
        started_at: null,
    };
    entries.push(entry);
    return entry;
}

/** Plays the part of a realtime event arriving. */
export function notifyChange() {
    notify?.();
}

/** Plays the part of a phone sending a command over the player channel. */
export function commandFromPhone(command: PlayerCommand) {
    phoneCommand?.(command);
}

export function resetFakeConnection() {
    entries = [];
    open = true;
    notify = null;
    phoneCommand = null;
    sentStates.length = 0;
}

export const createSession = vi.fn(async () => SESSION);

export const findOpenSession = vi.fn(async (code: string) =>
    code === SESSION.code ? SESSION : null,
);

export const isSessionOpen = vi.fn<(sessionId: number) => Promise<boolean>>(async () => open);

export function closeRoom() {
    open = false;
}

export const endSession = vi.fn<(sessionId: number) => Promise<void>>(async () => {
    open = false;
});

export const fetchQueue = vi.fn<(sessionId: number) => Promise<QueueItem[]>>(async () =>
    entries
        .filter((entry) => entry.status === 'queued' || entry.status === 'playing')
        .map((entry) => ({ ...entry })),
);

export const advanceQueue = vi.fn(async (_sessionId: number, finished: FinishedPlay | null) => {
    const playing = entries.find((entry) => entry.status === 'playing') ?? null;
    if ((playing?.id ?? null) !== (finished?.entryId ?? null)) return playing;
    if (playing) playing.status = 'done';
    const next = entries.find((entry) => entry.status === 'queued') ?? null;
    if (next) next.status = 'playing';
    return next;
});

export const reportUnplayable = vi.fn<(videoId: string, code: number) => Promise<void>>(
    async () => {},
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

export const closePlayerChannel = vi.fn();

export const openPlayerChannel = vi.fn(
    (_sessionId: number, handlers: Parameters<typeof openRealPlayerChannel>[1]): PlayerChannel => {
        phoneCommand = handlers.onCommand ?? null;
        void Promise.resolve().then(() => handlers.onReady?.());
        return {
            sendState: (state) => sentStates.push(state),
            sendCommand: () => {},
            close: () => {
                phoneCommand = null;
                closePlayerChannel();
            },
        };
    },
);
