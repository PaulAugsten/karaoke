import type { KeyboardEvent, RefObject } from 'react';
import { Button } from '@/components/Button';
import { RoomCode } from '@/components/RoomCode';
import { IdleScreen } from './IdleScreen';
import type { ConnectionStatus, QueueItem } from './stageConnection';

const CORNER_CLASS = 'fixed top-6 transition-opacity duration-700';

/** Left and Right move between the buttons in a row, wrapping round. */
function moveAlongRow(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const buttons = [...event.currentTarget.querySelectorAll('button')];
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    const step = event.key === 'ArrowRight' ? 1 : buttons.length - 1;
    buttons[(index + step) % buttons.length]?.focus();
    event.preventDefault();
}

interface EndPartyControlsProps {
    confirming: boolean;
    onConfirmingChange: (confirming: boolean) => void;
    onEnd: () => void;
    endButton: RefObject<HTMLButtonElement | null>;
    faint: boolean;
}

/** The top left corner: End party, which asks once more before it ends the room. */
function EndPartyControls({
    confirming,
    onConfirmingChange,
    onEnd,
    endButton,
    faint,
}: EndPartyControlsProps) {
    return (
        <div
            role="toolbar"
            aria-label="Party"
            onKeyDown={moveAlongRow}
            className={`${CORNER_CLASS} left-6 flex gap-3 ${faint ? 'opacity-20' : ''}`}
        >
            {confirming ? (
                <>
                    <Button
                        key="keep"
                        variant="outline"
                        size="lg"
                        autoFocus
                        onClick={() => onConfirmingChange(false)}
                    >
                        Keep singing
                    </Button>
                    <Button key="confirm" variant="danger" size="lg" onClick={onEnd}>
                        End party
                    </Button>
                </>
            ) : (
                <Button
                    key="end"
                    ref={endButton}
                    variant="outline"
                    size="lg"
                    onClick={() => onConfirmingChange(true)}
                >
                    End party
                </Button>
            )}
        </div>
    );
}

interface RoomBadgeProps {
    code: string;
    /** The idle screen already shows the code in large. */
    showCode: boolean;
    status: ConnectionStatus;
    faint: boolean;
}

/** The top right corner: the room code, and a note while the live connection is down. */
function RoomBadge({ code, showCode, status, faint }: RoomBadgeProps) {
    const connected = status === 'SUBSCRIBED';
    if (!showCode && connected) return null;
    return (
        <div
            className={`${CORNER_CLASS} right-6 flex items-center gap-3 rounded-xl border border-line bg-background/80 px-4 py-3 ${faint ? 'opacity-20' : ''}`}
        >
            {showCode && (
                <>
                    <span className="font-bold text-muted text-xs uppercase tracking-widest">
                        Room
                    </span>
                    <RoomCode code={code} />
                </>
            )}
            {!connected && (
                <span className="text-muted text-sm">
                    {status === 'CONNECTING' ? 'Connecting...' : 'Reconnecting...'}
                </span>
            )}
        </div>
    );
}

interface RoomOverlayProps {
    code: string;
    queueLoaded: boolean;
    status: ConnectionStatus;
    playback: {
        playing: QueueItem | null;
        hasQueued: boolean;
        paused: boolean;
        hasPlayed: boolean;
    };
    corner: { awake: boolean; confirmingEnd: boolean; setConfirmingEnd: (value: boolean) => void };
    endButton: RefObject<HTMLButtonElement | null>;
    onEnd: () => void;
}

/** Everything drawn over the player while a room is open. */
export function RoomOverlay({
    code,
    queueLoaded,
    status,
    playback,
    corner,
    endButton,
    onEnd,
}: RoomOverlayProps) {
    const { playing, hasQueued, paused, hasPlayed } = playback;
    const idle = queueLoaded && !playing && !hasQueued;
    const faint = !corner.awake && playing !== null && !paused;

    return (
        <>
            {idle && (
                <IdleScreen
                    code={code}
                    headline={hasPlayed ? "Who's next?" : "Who's singing first?"}
                />
            )}
            <EndPartyControls
                confirming={corner.confirmingEnd}
                onConfirmingChange={corner.setConfirmingEnd}
                onEnd={onEnd}
                endButton={endButton}
                faint={faint}
            />
            <RoomBadge code={code} showCode={!idle} status={status} faint={faint} />
            {paused && playing && (
                <p className="fixed top-6 left-1/2 -translate-x-1/2 rounded-full border border-line bg-background/80 px-5 py-2 font-bold text-sm uppercase tracking-widest">
                    Paused · press OK to resume
                </p>
            )}
        </>
    );
}
