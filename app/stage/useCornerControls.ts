import { useEffect, useEffectEvent, useRef, useState } from 'react';

const AWAKE_MS = 5000;

/** Takes the remote off whatever button it was on, so OK means pause again. */
function deselect() {
    (document.activeElement as HTMLElement | null)?.blur();
}

interface CornerOptions {
    /** Whether a room is open; the remote does nothing before. */
    enabled: boolean;
    /** OK, or the play/pause key, while no button is selected. */
    onPlayPause: () => void;
}

/**
 * The corner controls and the TV remote that drives them. Up selects End party, Down and
 * Back deselect it, OK pauses. Any press, or a mouse move, lights the controls; they fade
 * again after a while without one.
 */
export function useCornerControls({ enabled, onPlayPause }: CornerOptions) {
    const [awake, setAwake] = useState(true);
    const [confirmingEnd, setConfirmingEnd] = useState(false);
    const sleepTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const endButton = useRef<HTMLButtonElement>(null);

    /** Lights the controls and lets them fade again after a while without a press. */
    function wake() {
        setAwake(true);
        clearTimeout(sleepTimer.current);
        sleepTimer.current = setTimeout(() => {
            setAwake(false);
            setConfirmingEnd(false);
            deselect();
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
        const onButton = document.activeElement instanceof HTMLButtonElement;
        switch (key) {
            case 'Enter':
            case ' ':
                if (onButton) return false; // a selected button gets the press
                onPlayPause();
                return true;
            case 'MediaPlayPause':
                onPlayPause();
                return true;
            case 'ArrowUp':
                if (!onButton) endButton.current?.focus();
                return true;
            case 'ArrowDown':
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

    return { awake, wake, reset, confirmingEnd, setConfirmingEnd, endButton };
}
