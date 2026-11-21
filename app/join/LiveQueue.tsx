'use client';

import { useState } from 'react';
import { Button } from '@/components/Button';
import { describeError } from '@/lib/describeError';
import { type ConnectionStatus, type QueueEntry, removeQueueItem } from './joinConnection';
import { NowSinging } from './NowSinging';
import { usePlayerChannel } from './usePlayerChannel';

interface LiveQueueProps {
    sessionId: number;
    queue: QueueEntry[] | null;
    status: ConnectionStatus;
    error: string | null;
}

export function LiveQueue({ sessionId, queue, status, error }: LiveQueueProps) {
    const { heard, send } = usePlayerChannel(sessionId);
    const [removing, setRemoving] = useState<number | null>(null);
    const [removeError, setRemoveError] = useState<string | null>(null);
    const waiting = queue?.filter((entry) => entry.status !== 'playing') ?? [];
    const playing = queue?.find((entry) => entry.status === 'playing');

    async function remove(entryId: number) {
        setRemoving(entryId);
        setRemoveError(null);
        try {
            await removeQueueItem(entryId);
        } catch (err) {
            setRemoveError(describeError(err));
        }
        setRemoving(null);
    }

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
            {(error ?? removeError) && (
                <p role="alert" className="text-danger text-sm">
                    {error ?? removeError}
                </p>
            )}
            {queue === null && <p className="text-muted">Loading...</p>}
            {queue?.length === 0 && <p className="text-muted">The queue is empty. Add a song!</p>}
            {playing && (
                <NowSinging
                    entryId={playing.id}
                    title={playing.title}
                    byline={byline(playing)}
                    heard={heard}
                    onCommand={send}
                />
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
                            <span className="min-w-0 flex-1 wrap-break-word">
                                <span className="block">{entry.title}</span>
                                <span className="block text-muted text-sm">{byline(entry)}</span>
                            </span>
                            {entry.mine && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    aria-label={`Remove ${entry.title}`}
                                    disabled={removing === entry.id}
                                    onClick={() => remove(entry.id)}
                                >
                                    Remove
                                </Button>
                            )}
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
