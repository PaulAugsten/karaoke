'use client';

import { useEffect, useState } from 'react';
import { describeError } from '@/lib/describeError';
import { enqueueVideo, type SearchResult, searchVideos } from './joinConnection';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

export function SongSearch({ roomCode }: { roomCode: string }) {
    const [query, setQuery] = useState('');
    const [found, setFound] = useState<{ query: string; results: SearchResult[] } | null>(null);
    const [addedIds, setAddedIds] = useState<ReadonlySet<string>>(new Set());
    const [error, setError] = useState<string | null>(null);

    const trimmed = query.trim();
    const searching = trimmed.length >= MIN_QUERY_LENGTH;
    const results = searching ? (found?.results ?? []) : [];
    const noMatches = searching && found?.query === trimmed && found.results.length === 0;

    // TODO: maybe do a dynamic search instead (feels more responsive)
    // Search once typing pauses
    useEffect(() => {
        if (!searching) return;
        const controller = new AbortController();
        const timer = setTimeout(() => {
            searchVideos(trimmed, controller.signal)
                .then((items) => {
                    if (!controller.signal.aborted) setFound({ query: trimmed, results: items });
                })
                .catch((err) => {
                    if (!controller.signal.aborted) setError(describeError(err));
                });
        }, DEBOUNCE_MS);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [trimmed, searching]);

    async function add(result: SearchResult) {
        setError(null);
        try {
            await enqueueVideo(roomCode, result.video_id);
            setAddedIds((ids) => new Set(ids).add(result.video_id));
        } catch (err) {
            setError(describeError(err));
        }
    }

    return (
        <section aria-labelledby="search-heading" className="flex flex-col gap-3">
            <h2 id="search-heading" className="font-semibold text-lg">
                Add a song
            </h2>
            <input
                type="search"
                aria-label="Search songs"
                placeholder="Artist or title"
                enterKeyHint="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="rounded-lg border border-muted/40 bg-transparent px-3 py-2 text-lg"
            />
            {error && (
                <p role="alert" className="text-red-600 text-sm">
                    {error}
                </p>
            )}
            {noMatches && <p className="text-muted">No songs found</p>}
            {results.length > 0 && (
                <ul className="flex flex-col divide-y divide-muted/20">
                    {results.map((result) => {
                        const added = addedIds.has(result.video_id);
                        return (
                            <li key={result.video_id}>
                                <button
                                    type="button"
                                    disabled={added}
                                    onClick={() => add(result)}
                                    className="flex w-full items-center justify-between gap-3 py-3 text-left disabled:opacity-60"
                                >
                                    <span>
                                        <span className="block">{result.title}</span>
                                        {result.artist && (
                                            <span className="block text-muted text-sm">
                                                {result.artist}
                                            </span>
                                        )}
                                    </span>
                                    <span className="shrink-0 text-sm">
                                        {added ? 'Added' : 'Add'}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
