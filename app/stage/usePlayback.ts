import { useEffect, useRef, useState } from 'react';
import {
    advanceQueue,
    type FinishedPlay,
    type PlayOutcome,
    type QueueItem,
    reportUnplayable,
} from './stageConnection';
import { useYouTubePlayer } from './useYouTubePlayer';
import { isPermanentError } from './youtubeErrors';

interface PlaybackOptions {
    /** The room on screen, or null while none is. Nothing plays without one. */
    sessionId: number | null;
    queue: QueueItem[] | null;
    /** The database moved on to the next entry; the queue needs loading again. */
    onAdvanced: () => void;
    onError: (err: unknown) => void;
    /** A song started or carried on after a pause. */
    onPlaying: () => void;
}

/** The log entry for the song that was playing, or null when nothing finished. */
function finishedPlay(
    playing: QueueItem | null,
    outcome: PlayOutcome | null,
    player: YT.Player | null,
): FinishedPlay | null {
    if (!playing || !outcome) return null;
    // A song only ends or fails in an event of the player, so there is one.
    const secondsPlayed = Math.round(player!.getCurrentTime());
    return { entryId: playing.id, outcome, secondsPlayed };
}

/**
 * The YouTube player, kept in step with the queue: it plays whatever the database says is
 * playing and asks the database to move on when a song ends or fails.
 */
export function usePlayback({ sessionId, queue, onAdvanced, onError, onPlaying }: PlaybackOptions) {
    const [paused, setPaused] = useState(false);
    const [hasPlayed, setHasPlayed] = useState(false);
    const loadedEntryId = useRef<number | null>(null);
    const advancing = useRef(false);

    const playing = queue?.find((item) => item.status === 'playing') ?? null;
    const hasQueued = queue?.some((item) => item.status === 'queued') ?? false;

    const { containerRef, player, ready } = useYouTubePlayer({
        onStateChange: (state) => {
            if (state === YT.PlayerState.ENDED) advance('completed');
            if (state === YT.PlayerState.PAUSED) setPaused(true);
            if (state === YT.PlayerState.PLAYING) {
                setPaused(false);
                onPlaying();
            }
        },
        onError: (code) => {
            if (playing && isPermanentError(code)) {
                reportUnplayable(playing.video_id, code).catch(onError);
            }
            advance('error'); // skip whatever failed
        },
    });

    /** Asks the database to move on from the entry currently playing. */
    function advance(outcome: PlayOutcome | null) {
        if (sessionId === null || advancing.current) return;
        advancing.current = true;
        const finished = finishedPlay(playing, outcome, player.current);
        if (finished) setHasPlayed(true);
        advanceQueue(sessionId, finished)
            .then(() => onAdvanced())
            .catch(onError)
            .finally(() => {
                advancing.current = false;
            });
    }

    // Keep the player in step with whatever the database says is playing.
    useEffect(() => {
        if (sessionId === null) return;
        const entryId = playing?.id ?? null;
        if (entryId === loadedEntryId.current) return;
        loadedEntryId.current = entryId;
        if (playing) {
            player.current?.loadVideoById(playing.video_id);
        } else {
            player.current?.stopVideo();
        }
    }, [sessionId, playing, player]);

    // Nothing playing but songs waiting: start the next one.
    useEffect(() => {
        if (sessionId !== null && !playing && hasQueued) advance(null);
    });

    function togglePause() {
        if (!playing) return;
        if (paused) player.current?.playVideo();
        else player.current?.pauseVideo();
    }

    function unMute() {
        player.current?.unMute();
    }

    /** Silences the player when the room closes and forgets the room's songs. */
    function stop() {
        player.current?.stopVideo();
        loadedEntryId.current = null;
        setPaused(false);
        setHasPlayed(false);
    }

    return {
        containerRef,
        ready,
        playing,
        hasQueued,
        paused,
        hasPlayed,
        togglePause,
        unMute,
        stop,
    };
}
