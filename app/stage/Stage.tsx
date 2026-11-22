'use client';

import { useEffect, useState } from 'react';
import { describeError } from '@/lib/describeError';
import { RoomOverlay } from './RoomOverlay';
import { StartScreen } from './StartScreen';
import { createSession, endSession, findOpenSession, type Session } from './stageConnection';
import { useCornerControls } from './useCornerControls';
import { usePhoneRemote } from './usePhoneRemote';
import { usePlayback } from './usePlayback';
import { useQueue } from './useQueue';

const ROOM_PARAM = 'room';

export function Stage() {
    const [session, setSession] = useState<Session | null>(null);
    const [started, setStarted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // The room on screen: only once Start was pressed, which also unlocks the sound.
    const room = started ? session : null;

    const { queue, status, refresh } = useQueue(session, {
        onClosed: leaveRoom,
        onError: showError,
    });
    const { containerRef, ready, unMute, stop, togglePause, seekBy, skip, obey, ...playback } =
        usePlayback({
            sessionId: room?.id ?? null,
            queue,
            onAdvanced: refresh,
            onError: showError,
            onPlaying: wakeCorner, // a new song shows the corner controls for a moment
        });
    const { wake, reset, endButton, skipButton, ...corner } = useCornerControls({
        enabled: room !== null,
        onPlayPause: togglePause,
        onSeek: seekBy,
        holdSkip: playback.nearEnd,
    });
    usePhoneRemote({
        sessionId: room?.id ?? null,
        state: {
            entryId: playback.playing?.id ?? null,
            position: playback.position,
            duration: playback.duration,
            paused: playback.paused && playback.playing !== null,
        },
        onCommand: obey,
    });

    // After a reload join the session named in the URL.
    useEffect(() => {
        const code = new URLSearchParams(window.location.search).get(ROOM_PARAM);
        if (!code) return;
        findOpenSession(code)
            .then((found) => {
                if (found) setSession(found);
            })
            .catch((err) => setError(describeError(err)));
    }, []);

    function wakeCorner() {
        wake();
    }

    function showError(err: unknown) {
        setError(describeError(err));
    }

    function leaveRoom() {
        stop();
        reset();
        window.history.replaceState(null, '', window.location.pathname);
        setSession(null);
        setStarted(false);
    }

    async function endParty() {
        try {
            await endSession(room!.id); // the button only exists while a room is open
            leaveRoom();
        } catch (err) {
            showError(err);
        }
    }

    async function start() {
        if (!ready || started) return;
        unMute();
        setStarted(true);
        if (session) return;
        try {
            const created = await createSession();
            window.history.replaceState(null, '', `?${ROOM_PARAM}=${created.code}`);
            setSession(created);
        } catch (err) {
            showError(err);
        }
    }

    return (
        <>
            <div ref={containerRef} className="fixed inset-0" />
            <div className="fixed inset-0" />

            {room && (
                <RoomOverlay
                    code={room.code}
                    queueLoaded={queue !== null}
                    status={status}
                    playback={playback}
                    corner={corner}
                    endButton={endButton}
                    skipButton={skipButton}
                    onEnd={endParty}
                    onSkip={skip}
                />
            )}

            {!started && (
                <StartScreen ready={ready} roomCode={session?.code ?? null} onStart={start} />
            )}

            {error && (
                <p
                    role="alert"
                    className="fixed inset-x-6 bottom-6 rounded-xl bg-danger p-4 font-bold text-danger-ink"
                >
                    {error}
                </p>
            )}
        </>
    );
}
