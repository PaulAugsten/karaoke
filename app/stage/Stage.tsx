'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { describeError } from '@/lib/describeError';
import {
    advanceQueue,
    type ConnectionStatus,
    createSession,
    endSession,
    fetchQueue,
    findOpenSession,
    isSessionOpen,
    type PlayOutcome,
    type QueueItem,
    reportUnplayable,
    type Session,
    subscribeToQueue,
} from './stageConnection';
import { useYouTubePlayer } from './useYouTubePlayer';
import { isPermanentError } from './youtubeErrors';

const ROOM_PARAM = 'room';

export function Stage() {
    const [session, setSession] = useState<Session | null>(null);
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [refreshCount, setRefreshCount] = useState(0);
    const [status, setStatus] = useState<ConnectionStatus>('CONNECTING');
    const [started, setStarted] = useState(false);
    const [confirmingEnd, setConfirmingEnd] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const loadedEntryId = useRef<number | null>(null);
    const advancing = useRef(false);

    const playing = queue.find((item) => item.status === 'playing') ?? null;
    const hasQueued = queue.some((item) => item.status === 'queued');

    const { containerRef, player, ready } = useYouTubePlayer({
        onStateChange: (state) => {
            if (state === YT.PlayerState.ENDED) advance('completed');
        },
        onError: (code) => {
            if (playing && isPermanentError(code)) {
                reportUnplayable(playing.video_id, code).catch(showError);
            }
            advance('error'); // skip whatever failed
        },
    });

    function leaveRoom() {
        player.current?.stopVideo();
        loadedEntryId.current = null;
        window.history.replaceState(null, '', window.location.pathname);
        setSession(null);
        setQueue([]);
        setStarted(false);
        setConfirmingEnd(false);
    }

    async function endParty() {
        if (!session) return;
        try {
            await endSession(session.id);
            leaveRoom();
        } catch (err) {
            showError(err);
        }
    }

    function showError(err: unknown) {
        setError(describeError(err));
    }

    /** Asks the database to move on from the entry currently playing. */
    function advance(outcome: PlayOutcome | null) {
        if (!session || advancing.current) return;
        advancing.current = true;
        const finished =
            playing && outcome
                ? {
                      entryId: playing.id,
                      outcome,
                      secondsPlayed: Math.round(player.current?.getCurrentTime() ?? 0),
                  }
                : null;
        advanceQueue(session.id, finished)
            .then(() => setRefreshCount((n) => n + 1))
            .catch(showError)
            .finally(() => {
                advancing.current = false;
            });
    }

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

    // Load the queue and load it again whenever it changes.
    // biome-ignore lint/correctness/useExhaustiveDependencies: refreshCount only triggers a reload
    useEffect(() => {
        if (!session) return;
        let cancelled = false;
        Promise.all([fetchQueue(session.id), isSessionOpen(session.id)])
            .then(([entries, open]) => {
                if (cancelled) return;
                if (open) setQueue(entries);
                else leaveRoom();
            })
            .catch((err) => {
                if (!cancelled) setError(describeError(err));
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- leaveRoom is new on every render
    }, [session, refreshCount]);

    // Realtime changes and reconnects trigger a reload.
    useEffect(() => {
        if (!session) return;
        const refresh = () => setRefreshCount((n) => n + 1);
        const unsubscribe = subscribeToQueue(session.id, refresh, setStatus);
        const onVisible = () => {
            if (document.visibilityState === 'visible') refresh();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            unsubscribe();
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [session]);

    // Keep the player in step with whatever the database says is playing.
    useEffect(() => {
        if (!started) return;
        const entryId = playing?.id ?? null;
        if (entryId === loadedEntryId.current) return;
        loadedEntryId.current = entryId;
        if (playing) {
            player.current?.loadVideoById(playing.video_id);
        } else {
            player.current?.stopVideo();
        }
    }, [started, playing, player]);

    // Nothing playing but songs waiting: start the next one
    useEffect(() => {
        if (started && session && !playing && hasQueued) advance(null);
    });

    async function start() {
        if (!ready || started) return;
        player.current?.unMute();
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
            <div ref={containerRef} style={{ position: 'fixed', inset: 0 }} />
            {session && (
                <div className="fixed top-6 right-6 rounded-xl border border-line bg-background/80 px-6 py-3">
                    <span className="font-mono text-4xl text-highlight tracking-widest">
                        {session.code}
                    </span>
                    {status !== 'SUBSCRIBED' && (
                        <span className="block text-muted text-sm">{status}</span>
                    )}
                </div>
            )}
            {started && session && (
                <div className="fixed top-6 left-6 flex gap-3 text-xl">
                    {confirmingEnd ? (
                        <>
                            <Button
                                variant="outline"
                                size="lg"
                                autoFocus
                                onClick={() => setConfirmingEnd(false)}
                            >
                                Keep singing
                            </Button>
                            <Button variant="danger" size="lg" onClick={endParty}>
                                End party
                            </Button>
                        </>
                    ) : (
                        <Button variant="outline" size="lg" onClick={() => setConfirmingEnd(true)}>
                            End party
                        </Button>
                    )}
                </div>
            )}
            {error && (
                <p
                    role="alert"
                    className="fixed inset-x-6 bottom-6 rounded-xl bg-danger p-4 font-bold text-danger-ink"
                >
                    {error}
                </p>
            )}
            {!started && (
                <Button
                    size="xl"
                    autoFocus
                    aria-disabled={!ready}
                    onClick={start}
                    className="fixed inset-0 m-auto h-24 w-64"
                >
                    {!ready ? 'Loading...' : session ? 'Resume' : 'Start'}
                </Button>
            )}
        </>
    );
}
