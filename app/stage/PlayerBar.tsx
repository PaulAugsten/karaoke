import { type RefObject, useEffect } from 'react';
import { Button } from '@/components/Button';
import { formatTime } from '@/lib/formatTime';

interface PlayerBarProps {
    position: number;
    duration: number; // 0 while YouTube does not know the length yet.
    shown: boolean;
    nearEnd: boolean;
    skipButton: RefObject<HTMLButtonElement | null>;
    onSkip: () => void;
}

/** Bottom of the screen during a song */
export function PlayerBar({
    position,
    duration,
    shown,
    nearEnd,
    skipButton,
    onSkip,
}: PlayerBarProps) {
    useEffect(() => {
        if (nearEnd) skipButton.current?.focus();
    }, [nearEnd, skipButton]);

    const known = duration > 0;
    const percent = known ? Math.min(100, (position / duration) * 100) : 0;

    return (
        <div
            className={`fixed inset-x-6 bottom-6 flex items-center gap-4 rounded-xl border border-line bg-background/80 px-5 py-3 transition-opacity duration-700 ${shown ? '' : 'opacity-0'}`}
        >
            <span className="font-mono text-lg tabular-nums">
                {known ? formatTime(position) : '-:--'}
            </span>
            <div
                role="progressbar"
                aria-label="Song progress"
                aria-valuemin={0}
                aria-valuemax={Math.round(duration)}
                aria-valuenow={Math.round(position)}
                aria-valuetext={
                    known ? `${formatTime(position)} of ${formatTime(duration)}` : undefined
                }
                className="h-2 flex-1 overflow-hidden rounded-full bg-line"
            >
                <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
            </div>
            <span className="font-mono text-lg tabular-nums">
                {known ? formatTime(duration) : '-:--'}
            </span>
            <Button ref={skipButton} variant="outline" size="lg" onClick={onSkip}>
                Skip
            </Button>
        </div>
    );
}
