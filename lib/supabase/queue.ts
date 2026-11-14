import type { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export type ConnectionStatus = 'CONNECTING' | `${REALTIME_SUBSCRIBE_STATES}`;

/** Calls onChange whenever a queue entry of this session changes */
export function subscribeToQueue(
    sessionId: number,
    onChange: () => void,
    onStatus?: (status: ConnectionStatus) => void,
): () => void {
    const supabase = createClient();
    const channel = supabase
        .channel(`queue:${sessionId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'queue_items',
                filter: `session_id=eq.${sessionId}`,
            },
            () => onChange(),
        )
        .subscribe((status) => {
            onStatus?.(status);
            if (status === 'SUBSCRIBED') onChange();
        });
    return () => {
        void supabase.removeChannel(channel);
    };
}
