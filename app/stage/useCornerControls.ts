import { useEffect, useEffectEvent, useRef, useState } from 'react';

const AWAKE_MS = 5000;
/** One press of left or right jumps this far. */
const SEEK_STEP_S = 10;

/** Takes the remote off whatever button it was on, so OK means pause again. */
function deselect() {
    (document.activeElement as HTMLElement | null)?.blur();
}

interface CornerOptions {
    /** Whether a room is open; the remote does nothing before. */
    enabled: boolean;
    /** OK, or the play/pause key, while no button is selected. */
    onPlayPause: () => void;
    /** Left and Right while no button is selected, Rewind and Fast forward: a jump in seconds. */
    onSeek: (seconds: number) => void;
    /** Keeps Skip selected when the controls go to sleep: it is offered for a song's outro. */
    holdSkip: boolean;
}

/**
 * The corner controls and the TV remote that drives them. Up selects End party, Down and
 * Back deselect it, OK pauses. Any press, or a mouse move, lights the controls; they fade
 * again after a while without one.
 */
export function useCornerControls({ enabled, onPlayPause, onSeek, holdSkip }: CornerOptions) {
    const [awake, setAwake] = useState(true);
    const [confirmingEnd, setConfirmingEnd] = useState(false);
    const sleepTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const endButton = useRef<HTMLButtonElement>(null);
    const skipButton = useRef<HTMLButtonElement>(null);
    const holdingSkip = useRef(holdSkip);

    useEffect(() => {
        holdingSkip.current = holdSkip;
    });

    /** Lights the controls and lets them fade again after a while without a press. */
    function wake() {
        setAwake(true);
        clearTimeout(sleepTimer.current);
        sleepTimer.current = setTimeout(() => {
            setAwake(false);
            setConfirmingEnd(false);
            const onSkip = document.activeElement === skipButton.current;
            if (!(onSkip && holdingSkip.current)) deselect();
        }, AWAKE_MS);
    }

    /** Back to how the controls start out, for the next room. */
    function reset() {
        clearTimeout(sleepTimer.current);
        setAwake(true);
        setConfirmingEnd(false);
    }

    /** Handles a key on the remote. Returns false for keys left to the browser. */
    function press(key: string): boolean {
        const selected = document.activeElement instanceof HTMLButtonElement;
        const onSkip = selected && document.activeElement === skipButton.current;
        switch (key) {
            case 'Enter':
            case ' ':
                if (selected) return false; // a selected button gets the press
                onPlayPause();
                return true;
            case 'MediaPlayPause':
                onPlayPause();
                return true;
            case 'ArrowLeft':
            case 'ArrowRight':
                if (selected && !onSkip) return false;
                onSeek(key === 'ArrowRight' ? SEEK_STEP_S : -SEEK_STEP_S);
                return true;
            case 'MediaRewind':
                onSeek(-SEEK_STEP_S);
                return true;
            case 'MediaFastForward':
                onSeek(SEEK_STEP_S);
                return true;
            case 'ArrowUp':
                if (onSkip) deselect();
                else if (!selected) endButton.current?.focus();
                return true;
            case 'ArrowDown':
                if (!selected) {
                    skipButton.current?.focus();
                } else if (!onSkip) {
                    setConfirmingEnd(false);
                    deselect();
                }
                return true;
            case 'Escape':
                setConfirmingEnd(false);
                deselect();
                return true;
            default:
                return false;
        }
    }

    const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
        wake();
        if (press(event.key)) event.preventDefault();
    });

    const onPointerMove = useEffectEvent(() => wake());

    // Listen to the remote (and a mouse, on a laptop) while a room is open.
    useEffect(() => {
        if (!enabled) return;
        const keyDown = (event: KeyboardEvent) => onKeyDown(event);
        const pointerMove = () => onPointerMove();
        document.addEventListener('keydown', keyDown);
        document.addEventListener('pointermove', pointerMove);
        return () => {
            document.removeEventListener('keydown', keyDown);
            document.removeEventListener('pointermove', pointerMove);
        };
    }, [enabled]);

    useEffect(() => () => clearTimeout(sleepTimer.current), []);

    return { awake, wake, reset, confirmingEnd, setConfirmingEnd, endButton, skipButton };
}
