import { Button } from '@/components/Button';
import { RoomCode } from '@/components/RoomCode';
import { Wordmark } from '@/components/Wordmark';

interface StartScreenProps {
    /** Whether the player has loaded; until then the button only says so. */
    ready: boolean;
    /** The room from the URL after a reload, which Start then resumes. */
    roomCode: string | null;
    onStart: () => void;
}

/** What the TV shows before a room is open. The press also unlocks the sound. */
export function StartScreen({ ready, roomCode, onStart }: StartScreenProps) {
    const label = roomCode ? 'Resume' : 'Start';
    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-8 bg-background">
            <h1 className="text-7xl">
                <Wordmark />
            </h1>
            {roomCode && <RoomCode code={roomCode} size="lg" />}
            <Button
                size="xl"
                autoFocus
                aria-disabled={!ready}
                onClick={onStart}
                className="min-w-64"
            >
                {ready ? label : 'Loading...'}
            </Button>
            <p className="text-muted text-xl">
                {roomCode
                    ? 'Press OK on the remote to carry on'
                    : 'Press OK on the remote to open a room'}
            </p>
        </div>
    );
}
