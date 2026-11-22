'use client';

import { useEffect, useState } from 'react';
import { describeError } from '@/lib/describeError';
import { enqueueVideo, type SearchResult, searchVideos } from './joinConnection';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

interface SongSearchProps {
    roomCode: string;
    inQueue: ReadonlyMap<string, number>;
    onAdded: () => void;
}

export function SongSearch({ roomCode, inQueue, onAdded }: SongSearchProps) {
    const [query, setQuery] = useState('');
    const [found, setFound] = useState<{ query: string; results: SearchResult[] } | null>(null);
    const [addingIds, setAddingIds] = useState<ReadonlySet<string>>(new Set());
    const [dismissed, setDismissed] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const trimmed = query.trim();
    const searching = trimmed.length >= MIN_QUERY_LENGTH;
    const results = searching ? (found?.results ?? []) : [];
    const noMatches = searching && found?.query === trimmed && found.results.length === 0;
    const open = !dismissed && (results.length > 0 || noMatches);

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

    // Escape closes the results wherever the focus is: in the field or on a result.
    useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setDismissed(true);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open]);

    async function add(result: SearchResult) {
        setError(null);
        setAddingIds((ids) => new Set(ids).add(result.video_id));
        try {
            await enqueueVideo(roomCode, result.video_id);
            onAdded();
        } catch (err) {
            setError(describeError(err));
        }
        setAddingIds((ids) => {
            const rest = new Set(ids);
            rest.delete(result.video_id);
            return rest;
        });
    }

    return (
        <>
            {/* Dims the page behind the results. A tap on it closes them. */}
            {open && (
                <button
                    type="button"
                    aria-label="Close search results"
                    tabIndex={-1}
                    onClick={() => setDismissed(true)}
                    className="fixed inset-0 z-10 cursor-default bg-background/75"
                />
            )}
            {/* relative: the results hang from this box instead of taking up room in the page. */}
            <div className={`relative flex flex-col gap-2 ${open ? 'z-20' : ''}`}>
                <div className="relative">
                    <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted"
                    >
                        <circle cx="11" cy="11" r="7" />
                        <path d="m21 21-4.3-4.3" />
                    </svg>
                    <input
                        type="search"
                        aria-label="Search songs"
                        placeholder="Search artist or title"
                        enterKeyHint="search"
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setDismissed(false);
                        }}
                        onFocus={() => setDismissed(false)}
                        className="w-full rounded-xl border border-field bg-surface py-3 pr-3 pl-10 text-lg placeholder:text-muted"
                    />
                </div>
                {error && (
                    <p role="alert" className="text-danger text-sm">
                        {error}
                    </p>
                )}
                {open && (
                    <div className="absolute inset-x-0 top-full z-20 mt-2 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface shadow-2xl shadow-black/60">
                        {noMatches && <p className="px-3 py-4 text-muted">No songs found</p>}
                        {results.length > 0 && (
                            <ul className="flex flex-col divide-y divide-line">
                                {results.map((result) => (
                                    <li key={result.video_id}>
                                        <ResultRow
                                            result={result}
                                            copies={inQueue.get(result.video_id) ?? 0}
                                            adding={addingIds.has(result.video_id)}
                                            onAdd={() => add(result)}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

interface ResultRowProps {
    result: SearchResult;
    /** How many times this video is waiting or playing. */
    copies: number;
    adding: boolean;
    onAdd: () => void;
}

/** One search result. It keeps its size when the song is added. */
function ResultRow({ result, copies, adding, onAdd }: ResultRowProps) {
    const count = copies > 1 ? ` ×${copies}` : '';
    return (
        <button
            type="button"
            disabled={adding}
            onClick={onAdd}
            className="flex w-full items-center gap-3 px-3 py-3 text-left focus-visible:-outline-offset-2 disabled:opacity-50"
        >
            <span className="min-w-0 flex-1 wrap-break-word">
                <span className="block">{result.title}</span>
                {result.artist && <span className="block text-muted text-sm">{result.artist}</span>}
            </span>
            {/* Always there, so a tick appearing never squeezes the title. */}
            <span className="w-12 shrink-0 text-right font-bold text-highlight text-sm">
                {copies > 0 && (
                    <>
                        <span aria-hidden="true">✓{count}</span>
                        <span className="sr-only">✓ In queue{count}</span>
                    </>
                )}
            </span>
            {/* Says Add even while adding, so the pill keeps its width. */}
            <span className="shrink-0 rounded-full border-2 border-field px-3 py-1 font-bold text-sm">
                {adding ? (
                    <>
                        <span aria-hidden="true">Add</span>
                        <span className="sr-only">Adding...</span>
                    </>
                ) : (
                    'Add'
                )}
            </span>
        </button>
    );
}
