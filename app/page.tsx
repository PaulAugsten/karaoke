import Form from 'next/form';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { buttonClass } from '@/components/buttonClass';
import { Panel } from '@/components/Panel';
import { RoomCodeInput } from '@/components/RoomCodeInput';
import { Wordmark } from '@/components/Wordmark';

const STEPS = [
    'Start a stage on the TV',
    'Enter its room code on your phone',
    'Pick a song and sing',
];

export default function Home() {
    return (
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-3">
            <header>
                <h1 className="text-5xl">
                    <Wordmark />
                </h1>
                <p className="mt-1 text-muted">Pick songs on your phone.</p>
            </header>

            <Panel>
                <Form action="/join" className="flex flex-col gap-3">
                    <label
                        htmlFor="room-code"
                        className="font-bold text-muted text-xs uppercase tracking-widest"
                    >
                        Room code
                    </label>
                    <RoomCodeInput id="room-code" name="room" required />
                    <Button type="submit">Join the room</Button>
                </Form>
            </Panel>

            <p className="text-center text-muted text-sm">or</p>

            <Link autoFocus className={buttonClass('outline')} href="/stage">
                Start a stage
            </Link>

            <ol className="flex flex-col gap-1.5 text-muted text-sm">
                {STEPS.map((step, index) => (
                    <li key={step} className="flex items-center gap-3">
                        <span
                            aria-hidden="true"
                            className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line font-bold text-highlight text-xs"
                        >
                            {index + 1}
                        </span>
                        {step}
                    </li>
                ))}
            </ol>
        </main>
    );
}
