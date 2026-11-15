// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/health/route';

type Result = { error: Error | null };

const db = vi.hoisted(() => ({
    readSongs: vi.fn<() => Promise<Result>>(async () => ({ error: null })),
    rpc: vi.fn<(name: string) => Promise<Result>>(async () => ({ error: null })),
}));

vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: () => ({
        from: () => ({ select: () => ({ limit: db.readSongs }) }),
        rpc: db.rpc,
    }),
}));

describe('GET /api/health', () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    it('reports ok and closes stale rooms', async () => {
        const response = await GET();

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ status: 'ok' });
        expect(db.rpc).toHaveBeenCalledWith('close_stale_sessions');
    });

    it('reports an error when the database cannot be read', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        db.readSongs.mockResolvedValueOnce({ error: new Error('database down') });

        const response = await GET();

        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({ status: 'error' });
    });

    it('reports an error when closing stale rooms fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        db.rpc.mockResolvedValueOnce({ error: new Error('sweep failed') });

        const response = await GET();

        expect(response.status).toBe(503);
    });
});
