import type { KeyboardEvent, RefObject } from 'react';
import { Button } from '@/components/Button';
import { RoomCode } from '@/components/RoomCode';
import { IdleScreen } from './IdleScreen';
import { PlayerBar } from './PlayerBar';
import type { ConnectionStatus, QueueItem } from './stageConnection';

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
    hidden: boolean;
}

/** The top left corner: End party, which asks once more before it ends the room. */
function EndPartyControls({
    confirming,
    onConfirmingChange,
    onEnd,
    endButton,
    hidden,
}: EndPartyControlsProps) {
    return (
        <div
            role="toolbar"
            aria-label="Party"
            onKeyDown={moveAlongRow}
            className={`fixed top-6 left-6 flex gap-3 transition-opacity duration-700 ${hidden ? 'opacity-0' : ''}`}
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
}

/** The top right corner: the room code, and a note while the live connection is down. */
function RoomBadge({ code, showCode, status }: RoomBadgeProps) {
    const connected = status === 'SUBSCRIBED';
    if (!showCode && connected) return null;
    return (
        <div
            className={
                'fixed top-6 right-6 flex items-center gap-3 rounded-xl border border-line bg-background/80 px-4 py-3'
            }
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

/** Covers the player while a song is paused, because YouTube shows its own suggestions over a paused video. */
function PausedCover() {
    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-background/85 backdrop-blur-xl">
            <p className="font-display font-extrabold text-6xl">Paused</p>
            <p className="text-2xl text-muted">Press OK to resume</p>
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
        position: number;
        duration: number;
        nearEnd: boolean;
    };
    corner: { awake: boolean; confirmingEnd: boolean; setConfirmingEnd: (value: boolean) => void };
    endButton: RefObject<HTMLButtonElement | null>;
    skipButton: RefObject<HTMLButtonElement | null>;
    onEnd: () => void;
    onSkip: () => void;
}

/** Everything drawn over the player while a room is open. */
export function RoomOverlay({
    code,
    queueLoaded,
    status,
    playback,
    corner,
    endButton,
    skipButton,
    onEnd,
    onSkip,
}: RoomOverlayProps) {
    const { playing, hasQueued, paused, hasPlayed, position, duration, nearEnd } = playback;
    const idle = queueLoaded && !playing && !hasQueued;
    const asleep = !corner.awake && playing !== null && !paused;

    return (
        <>
            {paused && playing && <PausedCover />}
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
                hidden={asleep}
            />
            <RoomBadge code={code} showCode={!idle} status={status} />
            {playing && (
                <PlayerBar
                    key={playing.id}
                    position={position}
                    duration={duration}
                    shown={!asleep || nearEnd}
                    nearEnd={nearEnd}
                    skipButton={skipButton}
                    onSkip={onSkip}
                />
            )}
        </>
    );
}
