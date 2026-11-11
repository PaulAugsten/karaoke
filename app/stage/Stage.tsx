'use client';

import { useState } from 'react';
import { reportUnplayable } from './stageConnection';
import { useYouTubePlayer } from './useYouTubePlayer';
import { isPermanentError } from './youtubeErrors';

// TODO: replace with load commands from server later
const DEMO_QUEUE = ['dQw4w9WgXcQ', 'M7lc1UVf-VE'];

export function Stage() {
    const [queue, setQueue] = useState(DEMO_QUEUE);
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [started, setStarted] = useState(false);

    const { containerRef, player, ready } = useYouTubePlayer({
        onStateChange: (state) => {
            if (state === YT.PlayerState.ENDED) playNext();
        },
        onError: (code) => {
            if (currentId && isPermanentError(code)) reportUnplayable(currentId, code);
            playNext(); // skip whatever failed
        },
    });

    function playNext() {
        const [next, ...rest] = queue;
        setQueue(rest);
        setCurrentId(next ?? null);
        if (next)
            player.current?.loadVideoById(next); // loadVideoById autoplays
        else player.current?.stopVideo();
    }

    function start() {
        if (!ready) return;
        player.current?.unMute();
        playNext();
        setStarted(true);
    }

    return (
        <>
            <div ref={containerRef} style={{ position: 'fixed', inset: 0 }} />
            {!started && (
                <button
                    type="button"
                    // biome-ignore lint/a11y/noAutofocus: the Fire tv remote needs something focused to press
                    autoFocus
                    aria-disabled={!ready}
                    onClick={start}
                    className="fixed inset-0 m-auto h-24 w-64 rounded-xl bg-white text-3xl text-black aria-disabled:opacity-50"
                >
                    {ready ? 'Start' : 'Loading...'}
                </button>
            )}
        </>
    );
}
