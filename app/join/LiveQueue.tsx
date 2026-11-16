'use client';

import { useEffect, useState } from 'react';
import { describeError } from '@/lib/describeError';
import {
    type ConnectionStatus,
    fetchQueue,
    isSessionOpen,
    type QueueEntry,
    subscribeToQueue,
} from './joinConnection';

/** The session's queue, refetched on every realtime change */
function useLiveQueue(sessionId: number, onEnded: () => void) {
    const [queue, setQueue] = useState<QueueEntry[] | null>(null);
    const [status, setStatus] = useState<ConnectionStatus>('CONNECTING');
    const [error, setError] = useState<string | null>(null);
    const [refreshCount, setRefreshCount] = useState(0);

    // biome-ignore lint/correctness/useExhaustiveDependencies: refreshCount only triggers a reload
    useEffect(() => {
        let cancelled = false;
        Promise.all([fetchQueue(sessionId), isSessionOpen(sessionId)])
            .then(([entries, open]) => {
                if (cancelled) return;
                if (!open) return onEnded();
                setQueue(entries);
                setError(null);
            })
            .catch((err) => {
                if (!cancelled) setError(describeError(err));
            });
        return () => {
            cancelled = true;
        };
    }, [sessionId, refreshCount, onEnded]);

    useEffect(() => {
        const refresh = () => setRefreshCount((n) => n + 1);
        const unsubscribe = subscribeToQueue(sessionId, refresh, setStatus);
        const onVisible = () => {
            if (document.visibilityState === 'visible') refresh();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            unsubscribe();
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [sessionId]);

    return { queue, status, error };
}

export function LiveQueue({ sessionId, onEnded }: { sessionId: number; onEnded: () => void }) {
    const { queue, status, error } = useLiveQueue(sessionId, onEnded);
    const waiting = queue?.filter((entry) => entry.status !== 'playing') ?? [];
    const playing = queue?.find((entry) => entry.status === 'playing');

    return (
        <section aria-labelledby="queue-heading" className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
                <h2 id="queue-heading" className="font-display font-extrabold text-lg">
                    Queue
                </h2>
                <span className="font-bold text-muted text-xs uppercase tracking-widest">
                    {status === 'SUBSCRIBED'
                        ? queue && `${queue.length} ${queue.length === 1 ? 'song' : 'songs'}`
                        : status === 'CONNECTING'
                          ? 'Connecting...'
                          : 'Reconnecting...'}
                </span>
            </div>
            {error && (
                <p role="alert" className="text-danger text-sm">
                    {error}
                </p>
            )}
            {queue === null && <p className="text-muted">Loading...</p>}
            {queue?.length === 0 && <p className="text-muted">The queue is empty. Add a song!</p>}
            {playing && (
                <div className="rounded-xl border border-line border-l-4 border-l-accent bg-surface px-3 py-2">
                    <span className="flex items-center gap-2 font-bold text-accent text-xs uppercase tracking-widest">
                        <LevelBars />
                        <span>Now singing</span>
                    </span>
                    <span className="block wrap-break-word font-bold">{playing.title}</span>
                    <span className="block text-muted text-sm">{byline(playing)}</span>
                </div>
            )}
            {waiting.length > 0 && (
                <ol className="flex flex-col gap-2">
                    {waiting.map((entry, index) => (
                        <li
                            key={entry.id}
                            className="flex items-center gap-3 rounded-xl border border-line px-3 py-2"
                        >
                            <span
                                aria-hidden="true"
                                className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line font-bold text-muted text-xs"
                            >
                                {index + 1}
                            </span>
                            <span className="min-w-0 wrap-break-word">
                                <span className="block">{entry.title}</span>
                                <span className="block text-muted text-sm">{byline(entry)}</span>
                            </span>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

function byline(entry: QueueEntry): string {
    return [entry.artist, entry.singer].filter(Boolean).join(' · ');
}

/** Three small bars that bounce like a level meter. They stand still for reduced motion. */
function LevelBars() {
    return (
        <span aria-hidden="true" className="flex h-3 items-end gap-0.5">
            <span className="h-full w-0.5 origin-bottom animate-level rounded-full bg-accent motion-reduce:animate-none" />
            <span className="h-full w-0.5 origin-bottom animate-level rounded-full bg-accent [animation-delay:-0.4s] motion-reduce:animate-none" />
            <span className="h-full w-0.5 origin-bottom animate-level rounded-full bg-accent [animation-delay:-0.7s] motion-reduce:animate-none" />
        </span>
    );
}
