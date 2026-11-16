import { useEffect, useEffectEvent, useState } from 'react';
import {
    type ConnectionStatus,
    fetchQueue,
    isSessionOpen,
    type QueueItem,
    type Session,
    subscribeToQueue,
} from './stageConnection';

interface QueueHandlers {
    /** The room was ended, here or on another device. */
    onClosed: () => void;
    onError: (err: unknown) => void;
}

/**
 * The entries of `session` that are queued or playing. They load again on every realtime
 * change, after a reconnect and when the tab comes back into view.
 */
export function useQueue(session: Session | null, { onClosed, onError }: QueueHandlers) {
    // Tagged with its session, so the next room never starts out with the last one's queue.
    const [loaded, setLoaded] = useState<{ sessionId: number; entries: QueueItem[] } | null>(null);
    const [refreshCount, setRefreshCount] = useState(0);
    const [status, setStatus] = useState<ConnectionStatus>('CONNECTING');
    const closed = useEffectEvent(onClosed);
    const failed = useEffectEvent(onError);

    // biome-ignore lint/correctness/useExhaustiveDependencies: refreshCount only triggers a reload
    useEffect(() => {
        if (!session) return;
        let cancelled = false;
        Promise.all([fetchQueue(session.id), isSessionOpen(session.id)])
            .then(([entries, open]) => {
                if (cancelled) return;
                if (open) setLoaded({ sessionId: session.id, entries });
                else closed();
            })
            // Even a load that a newer one overtook failed for a reason worth showing.
            .catch((err) => failed(err));
        return () => {
            cancelled = true;
        };
    }, [session, refreshCount]);

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

    const queue = loaded && loaded.sessionId === session?.id ? loaded.entries : null;
    const refresh = () => setRefreshCount((n) => n + 1);
    return { queue, status, refresh };
}
