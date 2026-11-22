import { type PlayerCommand, type PlayerState, parseCommand, parseState } from '@/lib/playerState';
import { createClient } from '@/lib/supabase/client';

interface PlayerChannelHandlers {
    onState?: (state: PlayerState) => void;
    onCommand?: (command: PlayerCommand) => void;
    onReady?: () => void;
}

export interface PlayerChannel {
    sendState: (state: PlayerState) => void;
    sendCommand: (command: PlayerCommand) => void;
    close: () => void;
}

/** The room's player channel, on which the TV and the phones talk without the database. */
export function openPlayerChannel(
    sessionId: number,
    handlers: PlayerChannelHandlers,
): PlayerChannel {
    const supabase = createClient();
    let connected = false;
    const channel = supabase
        .channel(`player:${sessionId}`)
        .on('broadcast', { event: 'state' }, ({ payload }) => {
            const state = parseState(payload);
            if (state) handlers.onState?.(state);
        })
        .on('broadcast', { event: 'command' }, ({ payload }) => {
            const command = parseCommand(payload);
            if (command) handlers.onCommand?.(command);
        })
        .subscribe((status) => {
            connected = status === 'SUBSCRIBED';
            if (connected) handlers.onReady?.();
        });

    function send(event: 'state' | 'command', payload: PlayerState | PlayerCommand) {
        if (connected) void channel.send({ type: 'broadcast', event, payload });
    }

    return {
        sendState: (state) => send('state', state),
        sendCommand: (command) => send('command', command),
        close: () => {
            void supabase.removeChannel(channel);
        },
    };
}
