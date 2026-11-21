import { useEffect, useRef, useState } from 'react';
import {
    clampSeek,
    estimatePosition,
    type PlayerCommand,
    type PlayerState,
} from '@/lib/playerState';
import { openPlayerChannel, type PlayerChannel } from './joinConnection';

/** The TV's last word and when it arrived. */
export interface Heard {
    state: PlayerState;
    at: number;
}

function expectAfter(heard: Heard, command: PlayerCommand, now: number): Heard {
    const { state } = heard;
    if (command.entryId !== state.entryId) return heard;
    const position = estimatePosition(state, now - heard.at);
    switch (command.action) {
        case 'pause':
            return { state: { ...state, position, paused: true }, at: now };
        case 'play':
            return { state: { ...state, position, paused: false }, at: now };
        case 'seekBy':
            return {
                state: {
                    ...state,
                    position: clampSeek(position + command.seconds, state.duration),
                },
                at: now,
            };
        case 'seekTo':
            return {
                state: {
                    ...state,
                    position: clampSeek(command.seconds, state.duration),
                },
                at: now,
            };
        case 'skip':
            return heard;
    }
}

/** The phone's side of the player channel. */
export function usePlayerChannel(sessionId: number) {
    const [heard, setHeard] = useState<Heard | null>(null);
    const channel = useRef<PlayerChannel | null>(null);

    useEffect(() => {
        const opened = openPlayerChannel(sessionId, {
            onState: (state) => setHeard({ state, at: Date.now() }),
        });
        channel.current = opened;
        return () => {
            opened.close();
            channel.current = null;
        };
    }, [sessionId]);

    function send(command: PlayerCommand) {
        channel.current?.sendCommand(command);
        const now = Date.now();
        setHeard((last) => last && expectAfter(last, command, now));
    }

    return { heard, send };
}
