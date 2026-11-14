import type { Metadata } from 'next';
import { Join } from './Join';

export const metadata: Metadata = { title: 'Join' };

export default async function JoinPage({
    searchParams,
}: {
    searchParams: Promise<{ room?: string | string[] }>;
}) {
    const { room } = await searchParams;
    return <Join initialCode={typeof room === 'string' ? room : ''} />;
}
