'use client';

import { useEffect, useRef, useState } from 'react';
import {
    advanceQueue,
    type ConnectionStatus,
    createSession,
    fetchQueue,
    findOpenSession,
    type QueueItem,
    reportUnplayable,
    type Session,
    subscribeToQueue,
} from './stageConnection';
import { useYouTubePlayer } from './useYouTubePlayer';
import { isPermanentError } from './youtubeErrors';

const ROOM_PARAM = 'room';

function describeError(err: unknown): string {
    console.error(err);
    return err instanceof Error ? err.message : String(err);
}

export function Stage() {
    const [session, setSession] = useState<Session | null>(null);
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [refreshCount, setRefreshCount] = useState(0);
    const [status, setStatus] = useState<ConnectionStatus>('CONNECTING');
    const [started, setStarted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const loadedEntryId = useRef<number | null>(null);
    const advancing = useRef(false);

    const playing = queue.find((item) => item.status === 'playing') ?? null;
    const hasQueued = queue.some((item) => item.status === 'queued');

    const { containerRef, player, ready } = useYouTubePlayer({
        onStateChange: (state) => {
            if (state === YT.PlayerState.ENDED) advance();
        },
        onError: (code) => {
            if (playing && isPermanentError(code)) {
                reportUnplayable(playing.video_id, code).catch(showError);
            }
            advance(); // skip whatever failed
        },
    });

    function showError(err: unknown) {
        setError(describeError(err));
    }

    /** Asks the database to move on from the entry currently playing. */
    function advance() {
        if (!session || advancing.current) return;
        advancing.current = true;
        advanceQueue(session.id, playing?.id ?? null)
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
        fetchQueue(session.id)
            .then((items) => {
                if (!cancelled) setQueue(items);
            })
            .catch((err) => setError(describeError(err)));
        return () => {
            cancelled = true;
        };
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
        if (started && session && !playing && hasQueued) advance();
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
                <div className="fixed top-6 right-6 rounded-xl bg-black/70 px-6 py-3 text-white">
                    <span className="font-mono text-4xl tracking-widest">{session.code}</span>
                    {status !== 'SUBSCRIBED' && (
                        <span className="block text-sm text-yellow-300">{status}</span>
                    )}
                </div>
            )}
            {error && (
                <p
                    role="alert"
                    className="fixed inset-x-6 bottom-6 rounded-xl bg-red-700 p-4 text-white"
                >
                    {error}
                </p>
            )}
            {!started && (
                <button
                    type="button"
                    // biome-ignore lint/a11y/noAutofocus: the Fire tv remote needs something focused to press
                    autoFocus
                    aria-disabled={!ready}
                    onClick={start}
                    className="fixed inset-0 m-auto h-24 w-64 rounded-xl bg-white text-3xl text-black aria-disabled:opacity-50"
                >
                    {!ready ? 'Loading...' : session ? 'Resume' : 'Start'}
                </button>
            )}
        </>
    );
}
