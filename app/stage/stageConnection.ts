export function reportUnplayable(videoId: string, code: number): void {
    console.warn(`Unplayable video ${videoId} (YouTube error ${code})`);
}
