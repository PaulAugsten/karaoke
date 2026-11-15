import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSessionOpen, subscribeToQueue } from '@/lib/supabase/queue';

type ChangeHandler = (payload: { new: Record<string, unknown> }) => void;
type SessionResult = { data: { ended_at: string | null } | null; error: Error | null };

/** Stand-in for the Supabase client that lets tests fire realtime events by hand. */
const supabase = vi.hoisted(() => ({
    handlers: new Map<string, ChangeHandler>(),
    setStatus: null as ((status: string) => void) | null,
    removeChannel: vi.fn(),
    readSession: vi.fn<() => Promise<SessionResult>>(),
}));

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => {
        const channel = {
            on(_type: string, filter: { table: string }, handler: ChangeHandler) {
                supabase.handlers.set(filter.table, handler);
                return channel;
            },
            subscribe(callback: (status: string) => void) {
                supabase.setStatus = callback;
                return channel;
            },
        };
        return {
            channel: () => channel,
            removeChannel: supabase.removeChannel,
            from: () => ({
                select: () => ({ eq: () => ({ maybeSingle: supabase.readSession }) }),
            }),
        };
    },
}));

describe('subscribeToQueue', () => {
    afterEach(() => {
        supabase.handlers.clear();
        supabase.setStatus = null;
        vi.clearAllMocks();
    });

    it('reports changes to the queue', () => {
        const onChange = vi.fn();
        subscribeToQueue(1, onChange);

        supabase.handlers.get('queue_items')?.({ new: {} });

        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('ignores session updates until the session has ended', () => {
        const onChange = vi.fn();
        subscribeToQueue(1, onChange);

        supabase.handlers.get('sessions')?.({ new: { ended_at: null } });
        expect(onChange).not.toHaveBeenCalled();

        supabase.handlers.get('sessions')?.({ new: { ended_at: '2026-01-01T12:00:00Z' } });
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('passes the connection status on and reloads once subscribed', () => {
        const onChange = vi.fn();
        const onStatus = vi.fn();
        subscribeToQueue(1, onChange, onStatus);

        supabase.setStatus?.('CHANNEL_ERROR');
        expect(onStatus).toHaveBeenLastCalledWith('CHANNEL_ERROR');
        expect(onChange).not.toHaveBeenCalled();

        supabase.setStatus?.('SUBSCRIBED');
        expect(onStatus).toHaveBeenLastCalledWith('SUBSCRIBED');
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('removes the channel when unsubscribing', () => {
        const unsubscribe = subscribeToQueue(1, vi.fn());

        unsubscribe();

        expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
    });
});

describe('isSessionOpen', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('is true while the session has not ended', async () => {
        supabase.readSession.mockResolvedValueOnce({ data: { ended_at: null }, error: null });

        expect(await isSessionOpen(1)).toBe(true);
    });

    it('is false once the session has ended', async () => {
        supabase.readSession.mockResolvedValueOnce({
            data: { ended_at: '2026-01-01T12:00:00Z' },
            error: null,
        });

        expect(await isSessionOpen(1)).toBe(false);
    });

    it('is false when the session does not exist', async () => {
        supabase.readSession.mockResolvedValueOnce({ data: null, error: null });

        expect(await isSessionOpen(1)).toBe(false);
    });

    it('throws when the lookup fails', async () => {
        supabase.readSession.mockResolvedValueOnce({ data: null, error: new Error('offline') });

        await expect(isSessionOpen(1)).rejects.toThrow('offline');
    });
});
