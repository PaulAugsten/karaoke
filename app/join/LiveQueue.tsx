'use client';

import { useEffect, useState } from 'react';
import { describeError } from '@/lib/describeError';
import {
    type ConnectionStatus,
    fetchQueue,
    type QueueEntry,
    subscribeToQueue,
} from './joinConnection';

/** The session's queue, refetched on every realtime change */
function useLiveQueue(sessionId: number) {
    const [queue, setQueue] = useState<QueueEntry[] | null>(null);
    const [status, setStatus] = useState<ConnectionStatus>('CONNECTING');
    const [error, setError] = useState<string | null>(null);
    const [refreshCount, setRefreshCount] = useState(0);

    // biome-ignore lint/correctness/useExhaustiveDependencies: refreshCount only triggers a reload
    useEffect(() => {
        let cancelled = false;
        fetchQueue(sessionId)
            .then((entries) => {
                if (cancelled) return;
                setQueue(entries);
                setError(null);
            })
            .catch((err) => {
                if (!cancelled) setError(describeError(err));
            });
        return () => {
            cancelled = true;
        };
    }, [sessionId, refreshCount]);

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

export function LiveQueue({ sessionId }: { sessionId: number }) {
    const { queue, status, error } = useLiveQueue(sessionId);

    return (
        <section aria-labelledby="queue-heading" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
                <h2 id="queue-heading" className="font-semibold text-lg">
                    Queue
                </h2>
                {status !== 'SUBSCRIBED' && (
                    <span className="text-sm text-yellow-600">
                        {status === 'CONNECTING' ? 'Connecting...' : 'Reconnecting...'}
                    </span>
                )}
            </div>
            {error && (
                <p role="alert" className="text-red-600 text-sm">
                    {error}
                </p>
            )}
            {queue === null && <p className="text-muted">Loading...</p>}
            {queue?.length === 0 && <p className="text-muted">The queue is empty. Add a song!</p>}
            {queue && queue.length > 0 && (
                <ol className="flex flex-col gap-2">
                    {queue.map((entry) => (
                        <li
                            key={entry.id}
                            className={
                                entry.status === 'playing'
                                    ? 'rounded-lg bg-foreground px-3 py-2 text-surface'
                                    : 'rounded-lg border border-muted/30 px-3 py-2'
                            }
                        >
                            {entry.status === 'playing' && (
                                <span className="block text-xs uppercase tracking-wide">
                                    Now singing
                                </span>
                            )}
                            <span className="block">{entry.title}</span>
                            <span className="block text-sm opacity-70">
                                {[entry.artist, entry.singer].filter(Boolean).join(' · ')}
                            </span>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}
