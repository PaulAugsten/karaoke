import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Health check that round-trips to the database. Hit hourly by the uptime
 * smoke test, which also keeps the Supabase project from pausing on inactivity.
 */
export async function GET() {
    try {
        const { error } = await createAdminClient().from('songs').select('id').limit(1);
        if (error) throw error;
        return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Health check failed', error);
        return Response.json(
            { status: 'error' },
            { status: 503, headers: { 'Cache-Control': 'no-store' } },
        );
    }
}
