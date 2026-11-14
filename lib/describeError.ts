/** Logs an error and turns it into a message that can be shown to the user. */
export function describeError(err: unknown): string {
    console.error(err);
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err !== null && 'message' in err) return String(err.message);
    return String(err);
}
