import { afterEach, describe, expect, it, vi } from 'vitest';
import { openPlayerChannel } from '@/lib/supabase/player';

type BroadcastHandler = (message: { payload: unknown }) => void;

/** Stand-in for the Supabase client that lets tests deliver broadcasts by hand. */
const supabase = vi.hoisted(() => ({
    topic: null as string | null,
    handlers: new Map<string, BroadcastHandler>(),
    setStatus: null as ((status: string) => void) | null,
    send: vi.fn(),
    removeChannel: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => {
        const channel = {
            on(_type: string, filter: { event: string }, handler: BroadcastHandler) {
                supabase.handlers.set(filter.event, handler);
                return channel;
            },
            subscribe(callback: (status: string) => void) {
                supabase.setStatus = callback;
                return channel;
            },
            send: supabase.send,
        };
        return {
            channel: (topic: string) => {
                supabase.topic = topic;
                return channel;
            },
            removeChannel: supabase.removeChannel,
        };
    },
}));

const STATE = { entryId: 7, position: 61, duration: 238, paused: false };

describe('openPlayerChannel', () => {
    afterEach(() => {
        supabase.topic = null;
        supabase.handlers.clear();
        supabase.setStatus = null;
        vi.clearAllMocks();
    });

    it("uses a channel of the room's own", () => {
        openPlayerChannel(12, {});
        expect(supabase.topic).toBe('player:12');
    });

    it('hands on states and commands that arrive, and drops anything else', () => {
        const onState = vi.fn();
        const onCommand = vi.fn();
        openPlayerChannel(12, { onState, onCommand });

        supabase.handlers.get('state')?.({ payload: STATE });
        supabase.handlers.get('state')?.({ payload: { entryId: 7 } });
        supabase.handlers.get('command')?.({ payload: { action: 'skip', entryId: 7 } });
        supabase.handlers.get('command')?.({ payload: { action: 'explode', entryId: 7 } });

        expect(onState).toHaveBeenCalledExactlyOnceWith(STATE);
        expect(onCommand).toHaveBeenCalledExactlyOnceWith({ action: 'skip', entryId: 7 });
    });

    it('sends nothing until connected, and says when it is', () => {
        const onReady = vi.fn();
        const channel = openPlayerChannel(12, { onReady });

        channel.sendState(STATE);
        expect(supabase.send).not.toHaveBeenCalled();

        supabase.setStatus?.('SUBSCRIBED');
        expect(onReady).toHaveBeenCalledTimes(1);
        channel.sendState(STATE);
        channel.sendCommand({ action: 'pause', entryId: 7 });
        expect(supabase.send).toHaveBeenNthCalledWith(1, {
            type: 'broadcast',
            event: 'state',
            payload: STATE,
        });
        expect(supabase.send).toHaveBeenNthCalledWith(2, {
            type: 'broadcast',
            event: 'command',
            payload: { action: 'pause', entryId: 7 },
        });
    });

    it('stops sending while the connection is down', () => {
        const channel = openPlayerChannel(12, {});
        supabase.setStatus?.('SUBSCRIBED');

        supabase.setStatus?.('CHANNEL_ERROR');
        channel.sendState(STATE);

        expect(supabase.send).not.toHaveBeenCalled();
    });

    it('removes the channel when closed', () => {
        const channel = openPlayerChannel(12, {});
        channel.close();
        expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
    });
});
