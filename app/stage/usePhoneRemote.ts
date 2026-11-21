import { useEffect, useEffectEvent, useRef } from 'react';
import { estimatePosition, type PlayerCommand, type PlayerState } from '@/lib/playerState';
import { openPlayerChannel, type PlayerChannel } from './stageConnection';

const STATE_EVERY_MS = 3000;
const DRIFT_S = 1;

interface PhoneRemoteOptions {
    sessionId: number | null;
    state: PlayerState;
    onCommand: (command: PlayerCommand) => void;
}

interface Sent {
    state: PlayerState;
    at: number;
}

/** Whethera phone that got sent would now show something other than state. */
function isOff(sent: Sent, state: PlayerState, now: number): boolean {
    const before = sent.state;
    if (
        before.entryId !== state.entryId ||
        before.paused !== state.paused ||
        before.duration !== state.duration
    ) {
        return true;
    }
    return Math.abs(estimatePosition(before, now - sent.at) - state.position) > DRIFT_S;
}

/** The TV's side of the phone remote. */
export function usePhoneRemote({ sessionId, state, onCommand }: PhoneRemoteOptions) {
    const channel = useRef<PlayerChannel | null>(null);
    const lastSent = useRef<Sent | null>(null);

    const send = useEffectEvent(() => {
        if (!channel.current) return;
        channel.current.sendState(state);
        lastSent.current = { state, at: Date.now() };
    });
    const obey = useEffectEvent(onCommand);

    useEffect(() => {
        if (sessionId === null) return;
        const opened = openPlayerChannel(sessionId, {
            onCommand: (command) => obey(command),
            onReady: () => send(),
        });
        channel.current = opened;
        const timer = setInterval(() => send(), STATE_EVERY_MS);
        return () => {
            clearInterval(timer);
            opened.close();
            channel.current = null;
            lastSent.current = null;
        };
    }, [sessionId]);

    const { entryId, position, duration, paused } = state;
    useEffect(() => {
        const sent = lastSent.current;
        if (sent && isOff(sent, { entryId, position, duration, paused }, Date.now())) send();
    }, [entryId, position, duration, paused]);
}
