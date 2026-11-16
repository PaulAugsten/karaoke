import Link from 'next/link';
import { buttonClass } from '@/components/Button';

export default function Home() {
    return (
        <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 p-6">
            <h1 className="font-display font-extrabold text-4xl">Karaoke</h1>
            <Link autoFocus className={`${buttonClass('outline')} self-start`} href={'/stage'}>
                Stage
            </Link>
        </main>
    );
}
