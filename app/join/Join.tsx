'use client';

import { type SubmitEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { Panel } from '@/components/Panel';
import { RoomCode } from '@/components/RoomCode';
import { RoomCodeInput } from '@/components/RoomCodeInput';
import { Wordmark } from '@/components/Wordmark';
import { describeError } from '@/lib/describeError';
import { joinSession, type QueueEntry, type Session } from './joinConnection';
import { LiveQueue } from './LiveQueue';
import { SongSearch } from './SongSearch';
import { useLiveQueue } from './useLiveQueue';

const NAME_KEY = 'karaoke:singer-name';
const LABEL_CLASS = 'font-bold text-muted text-xs uppercase tracking-widest';

function readSavedName(): string {
    try {
        return localStorage.getItem(NAME_KEY) ?? '';
    } catch {
        return '';
    }
}

function saveName(name: string) {
    try {
        localStorage.setItem(NAME_KEY, name);
    } catch {
        // Storage is blocked (name just isn't remembered)
    }
}

export function Join({ initialCode }: { initialCode: string }) {
    const [session, setSession] = useState<Session | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const nameInput = useRef<HTMLInputElement>(null);

    // localStorage only exists in the browser, so fill the name in after hydration.
    useEffect(() => {
        if (nameInput.current && !nameInput.current.value) {
            nameInput.current.value = readSavedName();
        }
    }, []);

    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const code = String(form.get('code') ?? '');
        const name = String(form.get('name') ?? '').trim();
        setBusy(true);
        setError(null);
        try {
            const joined = await joinSession(code, name);
            saveName(name);
            window.history.replaceState(null, '', `?room=${joined.code}`);
            setSession(joined);
        } catch (err) {
            setError(describeError(err));
        }
        setBusy(false);
    }

    if (session) {
        return (
            <Room
                session={session}
                onEnded={() => {
                    setSession(null);
                    setError('This party has ended.');
                }}
            />
        );
    }

    return (
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-3">
            <p className="text-xl">
                <Wordmark />
            </p>
            <header>
                <h1 className="font-display font-extrabold text-3xl">Almost in.</h1>
                <p className="mt-1 text-muted">Your name shows next to your songs on the TV.</p>
            </header>
            <Panel>
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <label htmlFor="join-code" className={LABEL_CLASS}>
                        Room code
                    </label>
                    <RoomCodeInput id="join-code" name="code" defaultValue={initialCode} required />
                    <label htmlFor="join-name" className={LABEL_CLASS}>
                        Your name
                    </label>
                    <input
                        ref={nameInput}
                        id="join-name"
                        name="name"
                        required
                        maxLength={30}
                        autoComplete="nickname"
                        // biome-ignore lint/a11y/noAutofocus: with the code already filled in, the name is the only thing left to type
                        autoFocus={initialCode !== ''}
                        className="rounded-xl border border-field bg-background px-3 py-3 text-lg"
                    />
                    <Button type="submit" disabled={busy}>
                        {busy ? 'Joining...' : 'Join the room'}
                    </Button>
                </form>
            </Panel>
            {error && (
                <p role="alert" className="text-danger">
                    {error}
                </p>
            )}
        </main>
    );
}

/** The room once joined. */
function Room({ session, onEnded }: { session: Session; onEnded: () => void }) {
    const { queue, status, error, refresh } = useLiveQueue(session.id, onEnded);

    return (
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-3">
            <header className="flex items-center justify-between gap-3">
                <span className="text-xl">
                    <Wordmark />
                </span>
                <h1 className="flex items-center gap-2">
                    <span className={LABEL_CLASS}>Room</span> <RoomCode code={session.code} />
                </h1>
            </header>
            <SongSearch roomCode={session.code} inQueue={countByVideo(queue)} onAdded={refresh} />
            <LiveQueue sessionId={session.id} queue={queue} status={status} error={error} />
        </main>
    );
}

/** How many times each video is waiting or playing. */
function countByVideo(queue: QueueEntry[] | null): ReadonlyMap<string, number> {
    const counts = new Map<string, number>();
    for (const entry of queue ?? []) {
        counts.set(entry.videoId, (counts.get(entry.videoId) ?? 0) + 1);
    }
    return counts;
}
