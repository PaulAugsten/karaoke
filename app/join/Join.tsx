'use client';

import { type SubmitEvent, useEffect, useRef, useState } from 'react';
import { describeError } from '@/lib/describeError';
import { joinSession, type Session } from './joinConnection';
import { LiveQueue } from './LiveQueue';
import { SongSearch } from './SongSearch';

const NAME_KEY = 'karaoke:singer-name';
const INPUT_CLASS = 'rounded-lg border-muted/40 bg-transparent px-3 py-2 text-lg';

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
        } finally {
            setBusy(false);
        }
    }

    if (session) {
        return (
            <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 p-4">
                <h1 className="font-semibold text-xl">
                    Room <span className="font-mono tracking-widest">{session.code}</span>
                </h1>
                <SongSearch roomCode={session.code} />
                <LiveQueue sessionId={session.id} />
            </main>
        );
    }

    return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
            <h1 className="font-semibold text-2xl">Join the karaoke</h1>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1">
                    <span className="text-muted text-sm">Room code</span>
                    <input
                        name="code"
                        defaultValue={initialCode}
                        required
                        maxLength={4}
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck={false}
                        className={`${INPUT_CLASS} font-mono uppercase tracking-widest`}
                    />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-muted text-sm">Your name</span>
                    <input
                        ref={nameInput}
                        name="name"
                        required
                        maxLength={30}
                        autoComplete="nickname"
                        className={INPUT_CLASS}
                    />
                </label>
                <button
                    type="submit"
                    disabled={busy}
                    className="rounded-lg bg-foreground px-4 py-3 text-lg text-surface disabled:opacity-50"
                >
                    {busy ? 'Joining...' : 'Join'}
                </button>
            </form>
            {error && (
                <p role="alert" className="text-red-600">
                    {error}
                </p>
            )}
        </main>
    );
}
