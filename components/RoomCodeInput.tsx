'use client';

import { type ComponentProps, useState } from 'react';

const LENGTH = 4;
const BOXES = Array.from({ length: LENGTH }, (_, index) => index);

type RoomCodeInputProps = Omit<
    ComponentProps<'input'>,
    'className' | 'maxLength' | 'minLength' | 'pattern' | 'pattern' | 'defaultValue' | 'value'
> & { defaultValue?: string };

/** The room code field */
export function RoomCodeInput({ defaultValue = '', onChange, ...props }: RoomCodeInputProps) {
    const initial = defaultValue.slice(0, LENGTH);
    const [length, setLength] = useState(initial.length);
    const active = Math.min(length, LENGTH - 1);

    return (
        <span className="@container relative grid h-14 grid-cols-4 gap-2 overflow-hidden">
            <input
                {...props}
                defaultValue={initial}
                minLength={LENGTH}
                maxLength={LENGTH}
                pattern="[A-Za-z]{4}"
                title="The four letters shown on TV"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) => {
                    setLength(event.currentTarget.value.length);
                    onChange?.(event);
                }}
                className="peer absolute inset-y-0 left-0 w-[125cqw] bg-transparent pl-[calc(12.5cqw-0.1875rem-0.5ch)] font-bold font-mono text-2xl text-highlight uppercase tracking-[calc(25cwq+0.125rem-1ch)] outline-none"
            />
            {BOXES.map((index) => (
                <span
                    key={index}
                    aria-hidden="true"
                    className={`pointer-events-none rounded-xl border bg-background ${
                        index === active
                            ? 'border-field peer-focus:border-2 peer-focus:border-highlight'
                            : 'border-field'
                    }`}
                />
            ))}
        </span>
    );
}
