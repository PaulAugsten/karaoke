import { QRCodeSVG } from 'qrcode.react';
import { useSyncExternalStore } from 'react';
import { RoomCode } from '@/components/RoomCode';
import { Wordmark } from '@/components/Wordmark';

// The address never changes while the page is open, so there is nothing to subscribe to.
const subscribe = () => () => {};

/** The page's origin, or null while rendering on the server. */
function useOrigin(): string | null {
    return useSyncExternalStore(
        subscribe,
        () => window.location.origin,
        () => null,
    );
}

const NUMBER_CLASS =
    'flex size-9 shrink-0 items-center justify-center rounded-full border border-line font-bold text-highlight text-lg';

/**
 * What the TV shows while no song is playing or waiting: how to join, as a QR code and
 * as a room code. It covers the player, so a stopped video never shows through.
 */
export function IdleScreen({ code, headline }: { code: string; headline: string }) {
    const origin = useOrigin();
    // Only ever shown after a button press, so this is for the server render alone.
    if (!origin) return null;
    const { host } = new URL(origin);

    // The extra room at the top (pt-28) is for the "End party" button in the corner.
    return (
        <div className="fixed inset-0 grid grid-cols-[1.15fr_1fr] items-center gap-16 bg-background px-16 pt-28 pb-12">
            <div>
                <p className="text-3xl">
                    <Wordmark />
                </p>
                <h1 className="mt-4 font-display font-extrabold text-6xl">{headline}</h1>
                <ol className="mt-6 flex flex-col gap-3 text-2xl text-muted">
                    <li className="flex items-center gap-4">
                        <span aria-hidden="true" className={NUMBER_CLASS}>
                            1
                        </span>
                        <span>
                            Scan the code, or open{' '}
                            <strong className="text-foreground">{host}</strong>
                        </span>
                    </li>
                    <li className="flex items-center gap-4">
                        <span aria-hidden="true" className={NUMBER_CLASS}>
                            2
                        </span>
                        Enter the room code and your name
                    </li>
                    <li className="flex items-center gap-4">
                        <span aria-hidden="true" className={NUMBER_CLASS}>
                            3
                        </span>
                        Pick a song. It plays here.
                    </li>
                </ol>
            </div>
            <div className="flex flex-col items-center gap-6">
                {/* A quarter of the screen's width: about what it takes to scan from a sofa. */}
                <div className="w-[25vw] rounded-3xl bg-white p-4">
                    <QRCodeSVG
                        value={`${origin}/join?room=${code}`}
                        title="QR code to join this room"
                        bgColor="#ffffff"
                        fgColor="#120e24"
                        className="h-auto w-full"
                    />
                </div>
                <div className="flex flex-col items-center gap-2">
                    <span className="font-bold text-muted text-sm uppercase tracking-widest">
                        Room code
                    </span>
                    <RoomCode code={code} size="lg" />
                </div>
            </div>
        </div>
    );
}
