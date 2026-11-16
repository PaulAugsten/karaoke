'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { RoomCode } from '@/components/RoomCode';
import { Wordmark } from '@/components/Wordmark';
import { describeError } from '@/lib/describeError';
import { IdleScreen } from './IdleScreen';
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
const AWAKE_MS = 5000;
const CORNER_CLASS = 'fixed top-6 transition-opacity duration-700';

export function Stage() {
    const [session, setSession] = useState<Session | null>(null);
    const [queue, setQueue] = useState<QueueItem[] | null>(null);
    const [refreshCount, setRefreshCount] = useState(0);
    const [status, setStatus] = useState<ConnectionStatus>('CONNECTING');
    const [started, setStarted] = useState(false);
    const [confirmingEnd, setConfirmingEnd] = useState(false);
    const [paused, setPaused] = useState(false);
    const [hasPlayed, setHasPlayed] = useState(false);
    const [awake, setAwake] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const loadedEntryId = useRef<number | null>(null);
    const advancing = useRef(false);
    const sleepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const corner = useRef<HTMLDivElement>(null);
    const endButton = useRef<HTMLButtonElement>(null);

    const playing = queue?.find((item) => item.status === 'playing') ?? null;
    const hasQueued = queue?.some((item) => item.status === 'queued') ?? false;
    const inRoom = started && session !== null;

    const idle = inRoom && queue !== null && !playing && !hasQueued;
    const faint = !awake && playing !== null && !paused;

    const { containerRef, player, ready } = useYouTubePlayer({
        onStateChange: (state) => {
            if (state === YT.PlayerState.ENDED) advance('completed');
            if (state === YT.PlayerState.PAUSED) setPaused(true);
            if (state === YT.PlayerState.PLAYING) {
                setPaused(false);
                wake(); // a new song shows the corner controls for a moment
            }
        },
        onError: (code) => {
            if (playing && isPermanentError(code)) {
                reportUnplayable(playing.video_id, code).catch(showError);
            }
            advance('error'); // skip whatever failed
        },
    });

    /** Lights the corner controls and lets them fade again after a while without a press. */
    function wake() {
        setAwake(true);
        if (sleepTimer.current) clearTimeout(sleepTimer.current);
        sleepTimer.current = setTimeout(() => {
            setAwake(false);
            setConfirmingEnd(false);
            deselect();
        }, AWAKE_MS);
    }

    /** Takes the remote off whatever button it was on, so OK means pause again. */
    function deselect() {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }

    function togglePause() {
        if (paused) player.current?.playVideo();
        else player.current?.pauseVideo();
    }

    function leaveRoom() {
        player.current?.stopVideo();
        loadedEntryId.current = null;
        if (sleepTimer.current) clearTimeout(sleepTimer.current);
        window.history.replaceState(null, '', window.location.pathname);
        setSession(null);
        setQueue(null);
        setStarted(false);
        setConfirmingEnd(false);
        setPaused(false);
        setHasPlayed(false);
        setAwake(true);
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
        if (finished) setHasPlayed(true);
        advanceQueue(session.id, finished)
            .then(() => setRefreshCount((n) => n + 1))
            .catch(showError)
            .finally(() => {
                advancing.current = false;
            });
    }

    /** The remote. */
    const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
        wake();
        const focused = document.activeElement;
        const onButton = focused instanceof HTMLButtonElement;
        switch (event.key) {
            case 'Enter':
            case ' ':
                if (onButton || !playing) return; // a selected button gets the press
                togglePause();
                break;
            case 'MediaPlayPause':
                if (!playing) return;
                togglePause();
                break;
            case 'ArrowUp':
                if (!onButton) endButton.current?.focus();
                break;
            case 'ArrowLeft':
            case 'ArrowRight': {
                const buttons = [...(corner.current?.querySelectorAll('button') ?? [])];
                const index = buttons.indexOf(focused as HTMLButtonElement);
                if (index === -1) return;
                const step = event.key === 'ArrowRight' ? 1 : buttons.length - 1;
                buttons[(index + step) % buttons.length]?.focus();
                break;
            }
            case 'ArrowDown':
            case 'Escape':
                setConfirmingEnd(false);
                deselect();
                break;
            default:
                return;
        }
        event.preventDefault();
    });

    const onPointerMove = useEffectEvent(() => wake());

    // Listen to the remote (and a mouse, on a laptop) while a room is open.
    useEffect(() => {
        if (!inRoom) return;
        const keyDown = (event: KeyboardEvent) => onKeyDown(event);
        const pointerMove = () => onPointerMove();
        document.addEventListener('keydown', keyDown);
        document.addEventListener('pointermove', pointerMove);
        return () => {
            document.removeEventListener('keydown', keyDown);
            document.removeEventListener('pointermove', pointerMove);
        };
    }, [inRoom]);

    useEffect(
        () => () => {
            if (sleepTimer.current) clearTimeout(sleepTimer.current);
        },
        [],
    );

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
            <div ref={containerRef} className="fixed inset-0" />
            <div className="fixed inset-0" />

            {idle && session && (
                <IdleScreen
                    code={session.code}
                    headline={hasPlayed ? "Who's next?" : "Who's singing first?"}
                />
            )}

            {started && session && (
                <div
                    ref={corner}
                    className={`${CORNER_CLASS} left-6 flex gap-3 ${faint ? 'opacity-20' : ''}`}
                >
                    {confirmingEnd ? (
                        <>
                            <Button
                                key="keep"
                                variant="outline"
                                size="lg"
                                autoFocus
                                onClick={() => setConfirmingEnd(false)}
                            >
                                Keep singing
                            </Button>
                            <Button key="confirm" variant="danger" size="lg" onClick={endParty}>
                                End party
                            </Button>
                        </>
                    ) : (
                        <Button
                            key="end"
                            ref={endButton}
                            variant="outline"
                            size="lg"
                            onClick={() => setConfirmingEnd(true)}
                        >
                            End party
                        </Button>
                    )}
                </div>
            )}

            {started && session && (!idle || status !== 'SUBSCRIBED') && (
                <div
                    className={`${CORNER_CLASS} right-6 flex items-center gap-3 rounded-xl border border-line bg-background/80 px-4 py-3 ${faint ? 'opacity-20' : ''}`}
                >
                    {!idle && (
                        <>
                            <span className="font-bold text-muted text-xs uppercase tracking-widest">
                                Room
                            </span>
                            <RoomCode code={session.code} />
                        </>
                    )}
                    {status !== 'SUBSCRIBED' && (
                        <span className="text-muted text-sm">
                            {status === 'CONNECTING' ? 'Connecting...' : 'Reconnecting...'}
                        </span>
                    )}
                </div>
            )}

            {paused && playing && (
                <p className="fixed top-6 left-1/2 -translate-x-1/2 rounded-full border border-line bg-background/80 px-5 py-2 font-bold text-sm uppercase tracking-widest">
                    Paused · press OK to resume
                </p>
            )}

            {!started && (
                <div className="fixed inset-0 flex flex-col items-center justify-center gap-8 bg-background">
                    <h1 className="text-7xl">
                        <Wordmark />
                    </h1>
                    {session && <RoomCode code={session.code} size="lg" />}
                    <Button
                        size="xl"
                        autoFocus
                        aria-disabled={!ready}
                        onClick={start}
                        className="min-w-64"
                    >
                        {!ready ? 'Loading...' : session ? 'Resume' : 'Start'}
                    </Button>
                    <p className="text-muted text-xl">
                        {session
                            ? 'Press OK on the remote to carry on'
                            : 'Press OK on the remote to open a room'}
                    </p>
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
        </>
    );
}
