import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { clampSeek, type PlayerCommand } from '@/lib/playerState';
import {
    advanceQueue,
    type FinishedPlay,
    type PlayOutcome,
    type QueueItem,
    reportUnplayable,
} from './stageConnection';
import { useYouTubePlayer } from './useYouTubePlayer';
import { isPermanentError } from './youtubeErrors';

/** How often the time is read from the player while a song plays. */
const TICK_MS = 250;
/** A song moves on this long before its video ends, so YouTube's end screen never shows. */
const END_EARLY_S = 1;
/** How long a jump's target stands in for the time YouTube reports, at most. */
const SEEK_SETTLE_MS = 1000;
/** The last stretch of a song, in which Skip is offered for the outro. */
const SKIP_WINDOW_S = 20;

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

/** The time of the video that was loaded for an entry, as last read from the player. */
interface Clock {
    entryId: number;
    position: number;
    duration: number;
}

/** Where the last jump went and when. */
interface Seek {
    entryId: number;
    position: number;
    at: number;
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
    const [clock, setClock] = useState<Clock | null>(null);
    // The entry whose video YouTube last said is playing; the clock only runs for that one
    const [runningFor, setRunningFor] = useState<number | null>(null);
    const loadedEntryId = useRef<number | null>(null);
    const advancing = useRef(false);
    // The entry already asked to move on from, so an early end, ENDED and SKIP move on once.
    const movedOnFrom = useRef<number | null>(null);
    const lastSeek = useRef<Seek | null>(null);

    const playing = queue?.find((item) => item.status === 'playing') ?? null;
    const hasQueued = queue?.some((item) => item.status === 'queued') ?? false;

    const { containerRef, player, ready } = useYouTubePlayer({
        onStateChange: (state) => {
            if (state === YT.PlayerState.ENDED) advance('completed');
            if (state === YT.PlayerState.PAUSED) {
                setPaused(true);
                readClock();
            }
            if (state === YT.PlayerState.PLAYING) {
                setPaused(false);
                onPlaying();
            }
            setRunningFor(state === YT.PlayerState.PLAYING ? loadedEntryId.current : null);
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
        if (playing && movedOnFrom.current === playing.id) return;
        advancing.current = true;
        movedOnFrom.current = playing?.id ?? null;
        const finished = finishedPlay(playing, outcome, player.current);
        if (finished) setHasPlayed(true);
        advanceQueue(sessionId, finished)
            .then(() => onAdvanced())
            .catch((err) => {
                movedOnFrom.current = null; // let the next tick or ENDED try again
                onError(err);
            })
            .finally(() => {
                advancing.current = false;
            });
    }

    /**
     * The player's time. Right after a jump YouTube still reports the time from before it,
     * so until it catches up (or a second has passed) the jump's target stands in for it.
     */
    function currentTime(): number {
        const reading = player.current?.getCurrentTime() ?? 0;
        const seek = lastSeek.current;
        if (!seek) return reading;
        const caughtUp =
            seek.entryId !== loadedEntryId.current ||
            Math.abs(reading - seek.position) < 1 ||
            Date.now() - seek.at > SEEK_SETTLE_MS;
        if (!caughtUp) return seek.position;
        lastSeek.current = null;
        return reading;
    }

    /** Reads the time of the loaded video into the clock and returns it. */
    function readClock(): Clock | null {
        const entryId = loadedEntryId.current;
        if (!player.current || entryId === null) return null;
        const read = {
            entryId,
            position: currentTime(),
            duration: player.current.getDuration(),
        };
        setClock(read);
        return read;
    }

    const tick = useEffectEvent(() => {
        const read = readClock();
        if (read && read.duration > 0 && read.position >= read.duration - END_EARLY_S) {
            advance('completed');
        }
    });

    // Read the time a few times a second while the loaded song is actually playing.
    const running = playing !== null && runningFor === playing.id;
    useEffect(() => {
        if (!running) return;
        const timer = setInterval(() => tick(), TICK_MS);
        return () => clearInterval(timer);
    }, [running]);

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

    function pause() {
        if (playing && !paused) player.current?.pauseVideo();
    }

    function play() {
        if (playing && paused) player.current?.playVideo();
    }

    function togglePause() {
        if (paused) play();
        else pause();
    }

    /** Jumps to a point in the song. */
    function seekTo(seconds: number) {
        const current = player.current;
        if (!current || !playing) return;
        const duration = current.getDuration();
        if (duration <= 0) return; // YouTube does not know the length yet
        const target = clampSeek(seconds, duration);
        current.seekTo(target, true);
        lastSeek.current = { entryId: playing.id, position: target, at: Date.now() };
        setClock({ entryId: playing.id, position: target, duration });
    }

    /** Jumps back (negative) or ahead in the song. */
    function seekBy(seconds: number) {
        seekTo(currentTime() + seconds);
    }

    function skip() {
        if (playing) advance('skipped');
    }

    /** Carries out what a phone asked, if it is meant for the song that is playing. */
    function obey(command: PlayerCommand) {
        if (command.entryId !== playing?.id) return;
        switch (command.action) {
            case 'skip':
                return skip();
            case 'pause':
                return pause();
            case 'play':
                return play();
            case 'seekBy':
                return seekBy(command.seconds);
            case 'seekTo':
                return seekTo(command.seconds);
        }
    }

    function unMute() {
        player.current?.unMute();
    }

    /** Silences the player when the room closes and forgets the room's songs. */
    function stop() {
        player.current?.stopVideo();
        loadedEntryId.current = null;
        movedOnFrom.current = null;
        lastSeek.current = null;
        setPaused(false);
        setHasPlayed(false);
        setClock(null);
        setRunningFor(null);
    }

    // A clock read for an earlier song says nothing about this one.
    const current = clock !== null && clock.entryId === playing?.id ? clock : null;
    const position = current?.position ?? 0;
    const duration = current?.duration ?? 0;

    return {
        containerRef,
        ready,
        playing,
        hasQueued,
        paused,
        hasPlayed,
        position,
        duration,
        nearEnd: duration > 0 && duration - position <= SKIP_WINDOW_S,
        togglePause,
        seekBy,
        skip,
        obey,
        unMute,
        stop,
    };
}
