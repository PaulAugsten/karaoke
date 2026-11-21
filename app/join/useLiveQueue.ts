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
export function useLiveQueue(sessionId: number, onEnded: () => void) {
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

    return { queue, status, error, refresh: () => setRefreshCount((n) => n + 1) };
}
