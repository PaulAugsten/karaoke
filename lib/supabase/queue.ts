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
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'sessions',
                filter: `id=eq.${sessionId}`,
            },
            (payload) => {
                if (payload.new.ended_at) onChange();
            },
        )
        .subscribe((status) => {
            onStatus?.(status);
            if (status === 'SUBSCRIBED') onChange();
        });
    return () => {
        void supabase.removeChannel(channel);
    };
}

export async function isSessionOpen(sessionId: number): Promise<boolean> {
    const { data, error } = await createClient()
        .from('sessions')
        .select('ended_at')
        .eq('id', sessionId)
        .maybeSingle();
    if (error) throw error;
    return data !== null && data.ended_at === null;
}
