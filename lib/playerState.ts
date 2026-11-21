/** A jump never lands closer to the end than this. */
const SEEK_END_MARGIN_S = 2;

/** What the TV plays and how far it is. */
export interface PlayerState {
    entryId: number | null;
    position: number;
    duration: number;
    paused: boolean;
}

/** What a phone asks the TV to do. */
export type PlayerCommand =
    | { action: 'skip' | 'pause' | 'play'; entryId: number }
    | { action: 'seekBy' | 'seekTo'; entryId: number; seconds: number };

function isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

/** A state from the player channel. */
export function parseState(payload: unknown): PlayerState | null {
    if (typeof payload !== 'object' || payload === null) return null;
    const { entryId, position, duration, paused } = payload as Record<string, unknown>;
    if (entryId !== null && !isNumber(entryId)) return null;
    if (!isNumber(position) || !isNumber(duration) || typeof paused !== 'boolean') return null;
    return { entryId, position, duration, paused };
}

/** A command form the player channel. */
export function parseCommand(payload: unknown): PlayerCommand | null {
    if (typeof payload !== 'object' || payload === null) return null;
    const { action, entryId, seconds } = payload as Record<string, unknown>;
    if (!isNumber(entryId)) return null;
    switch (action) {
        case 'skip':
        case 'pause':
        case 'play':
            return { action, entryId };
        case 'seekBy':
        case 'seekTo':
            return isNumber(seconds) ? { action, entryId, seconds } : null;
        default:
            return null;
    }
}

/** Where the song is elapsedMs after state was taken: it runs in unless paused. */
export function estimatePosition(state: PlayerState, elapsedMs: number): number {
    if (state.paused) return state.position;
    const position = state.position + Math.max(0, elapsedMs) / 1000;
    return state.duration > 0 ? Math.min(position, state.duration) : position;
}

/** A jump target held inside the song. */
export function clampSeek(seconds: number, duration: number): number {
    return Math.max(0, Math.min(seconds, duration - SEEK_END_MARGIN_S));
}
