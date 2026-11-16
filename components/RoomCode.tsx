type Size = 'sm' | 'lg';

const BOX: Record<Size, string> = {
    sm: 'h-7 w-6 rounded-md text-sm',
    lg: 'h-20 w-16 rounded-2xl text-5xl',
};

/** A room code is shown as four boxes. */
export function RoomCode({ code, size = 'sm' }: { code: string; size?: Size }) {
    return (
        <span className="inline-flex">
            <span className="sr-only">{code}</span>
            <span aria-hidden="true" className={size === 'sm' ? 'flex gap-1' : 'flex gap-3'}>
                {[...code].map((letter, index) => (
                    <span
                        // biome-ignore lint/suspicious/noArrayIndexKey: a code repeat a letter and its letters never reorder
                        key={index}
                        className={`flex items-center justify-center border border-line bg-surface font-bold font-mono text-highlight ${BOX[size]}`}
                    >
                        {letter}
                    </span>
                ))}
            </span>
        </span>
    );
}
