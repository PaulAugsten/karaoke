import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { formatTime } from '@/lib/formatTime';
import { estimatePosition, type PlayerCommand } from '@/lib/playerState';
import type { Heard } from './usePlayerChannel';

/** How often the time is counted on between the TV's messages. */
const TICK_MS = 250;
const STALE_MS = 10_000;
const STEP_S = 10;

interface NowSingingProps {
    entryId: number;
    title: string;
    byline: string;
    heard: Heard | null;
    onCommand: (command: PlayerCommand) => void;
}

/** The song on the TV. */
export function NowSinging({ entryId, title, byline, heard, onCommand }: NowSingingProps) {
    const [now, setNow] = useState(0);
    const [dragging, setDragging] = useState<number | null>(null);
    const slider = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), TICK_MS);
        return () => clearInterval(timer);
    }, []);

    const release = useEffectEvent(() => {
        const seconds = Number(slider.current?.value ?? 0);
        setDragging(null);
        onCommand({ action: 'seekTo', entryId, seconds });
    });
    useEffect(() => {
        const element = slider.current;
        if (!element) return;
        const onRelease = () => release();
        element.addEventListener('change', onRelease);
        return () => element.removeEventListener('change', onRelease);
    }, []);

    const fresh =
        heard !== null && heard.state.entryId === entryId && now - heard.at < STALE_MS
            ? heard
            : null;
    const paused = fresh?.state.paused ?? false;
    const duration = fresh?.state.duration ?? 0;
    const canSeek = fresh !== null && duration > 0;
    const position = fresh ? estimatePosition(fresh.state, now - fresh.at) : 0;
    const shown = dragging ?? position;

    return (
        <div className="rounded-xl border border-line border-l-4 border-l-accent bg-surface px-3 py-2">
            <span className="flex items-center gap-2 font-bold text-accent text-xs uppercase tracking-widest">
                <LevelBars />
                <span>Now singing</span>
            </span>
            <span className="block wrap-break-word font-bold">{title}</span>
            <span className="block text-muted text-sm">{byline}</span>
            <input
                ref={slider}
                type="range"
                aria-label="Song position"
                aria-valuetext={
                    canSeek ? `${formatTime(shown)} of ${formatTime(duration)}` : undefined
                }
                min={0}
                max={Math.max(1, Math.floor(duration))}
                step={1}
                value={Math.floor(shown)}
                disabled={!canSeek}
                onChange={(event) => {
                    if (event.nativeEvent.type === 'input') {
                        setDragging(Number(event.currentTarget.value));
                    }
                }}
                className="mt-3 w-full accent-accent disabled:opacity-50"
            />
            <div className="flex justify-between font-mono text-muted text-xs tabular-nums">
                <span>{canSeek ? formatTime(shown) : '-:--'}</span>
                <span>{canSeek ? formatTime(duration) : '-:--'}</span>
            </div>
            <div className="mt-2 flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={!canSeek}
                    onClick={() => onCommand({ action: 'seekBy', entryId, seconds: -STEP_S })}
                >
                    -10
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={!fresh}
                    onClick={() => onCommand({ action: paused ? 'play' : 'pause', entryId })}
                    className="min-w-20"
                >
                    {paused ? 'Play' : 'Pause'}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={!canSeek}
                    onClick={() => onCommand({ action: 'seekBy', entryId, seconds: STEP_S })}
                >
                    +10
                </Button>
                {/* Set apart, so it is not hit by accident while reaching for +10. */}
                <Button
                    variant="outline"
                    size="sm"
                    disabled={!fresh}
                    onClick={() => onCommand({ action: 'skip', entryId })}
                    className="ml-auto"
                >
                    Skip
                </Button>
            </div>
            {!fresh && <p className="mt-2 text-muted text-sm">Waiting for the TV...</p>}
        </div>
    );
}

/** Three small bars that bounce like a level meter. */
function LevelBars() {
    return (
        <span aria-hidden="true" className="flex h-3 items-end gap-0.5">
            <span className="h-full w-0.5 origin-bottom animate-level rounded-full bg-accent motion-reduce:animate-none" />
            <span className="h-full w-0.5 origin-bottom animate-level rounded-full bg-accent [animation-delay:-0.4s] motion-reduce:animate-none" />
            <span className="h-full w-0.5 origin-bottom animate-level rounded-full bg-accent [animation-delay:-0.7s] motion-reduce:animate-none" />
        </span>
    );
}
