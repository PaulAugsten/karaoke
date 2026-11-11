import { vi } from 'vitest';

/** Minimal stand-in for YT.Player that lets tests fire the player's events by hand. */
export class FakePlayer {
    static instances: FakePlayer[] = [];

    loadVideoById = vi.fn();
    stopVideo = vi.fn();
    unMute = vi.fn();
    destroy = vi.fn();

    constructor(
        readonly target: HTMLElement,
        readonly options: YT.PlayerOptions,
    ) {
        FakePlayer.instances.push(this);
    }

    ready() {
        this.options.events?.onReady?.({ target: this } as unknown as YT.PlayerEvent);
    }

    stateChange(data: YT.PlayerState) {
        this.options.events?.onStateChange?.({
            target: this,
            data,
        } as unknown as YT.OnStateChangeEvent);
    }

    error(data: YT.PlayerError) {
        this.options.events?.onError?.({ target: this, data } as unknown as YT.OnErrorEvent);
    }
}

// `YT.PlayerState` is a runtime enum on the global the real API script defines.
export const fakeYT = {
    Player: FakePlayer,
    PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
} as unknown as typeof YT;

/** Pretends the IFrame API script has already loaded. */
export function installFakeYouTube() {
    FakePlayer.instances = [];
    vi.stubGlobal('YT', fakeYT);
    window.YT = fakeYT;
}

export function resetFakeYouTube() {
    FakePlayer.instances = [];
    vi.unstubAllGlobals();
    delete window.YT;
    delete window.onYouTubeIframeAPIReady;
    for (const script of document.head.querySelectorAll('script')) script.remove();
}

export function latestPlayer(): FakePlayer {
    const player = FakePlayer.instances.at(-1);
    if (!player) throw new Error('no YT.Player created yet');
    return player;
}
