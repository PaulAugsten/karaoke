/** Seconds as m:ss, the way a player shows a song's time. */
export function formatTime(seconds: number): string {
    const whole = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(whole / 60);
    const rest = String(whole % 60).padStart(2, '0');
    return `${minutes}:${rest}`;
}
