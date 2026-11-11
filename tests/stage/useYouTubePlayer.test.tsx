import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { useYouTubePlayer, YouTubePlayerHandlers } from '@/app/stage/useYouTubePlayer';
import { FakePlayer, fakeYT, latestPlayer, resetFakeYouTube } from './fakeYouTube';

const API_SRC = 'https://www.youtube.com/iframe_api';

function Host({
    usePlayer,
    handlers,
}: {
    usePlayer: typeof useYouTubePlayer;
    handlers: YouTubePlayerHandlers;
}) {
    const { containerRef, ready } = usePlayer(handlers);
    return <div data-testid="host" data-ready={ready} ref={containerRef} />;
}

// The hook caches the API load in module state, so each test gets a fresh copy.
async function renderHookHost(handlers: YouTubePlayerHandlers = {}) {
    const { useYouTubePlayer } = await import('@/app/stage/useYouTubePlayer');
    return render(<Host usePlayer={useYouTubePlayer} handlers={handlers} />);
}

function apiScript() {
    const script = document.head.querySelector<HTMLScriptElement>(`script[src="${API_SRC}"]`);
    if (!script) throw new Error('API script not injected');
    return script;
}

function finishApiLoad() {
    vi.stubGlobal('YT', fakeYT);
    window.YT = fakeYT;
    window.onYouTubeIframeAPIReady?.();
}

describe('useYouTubePlayer', () => {
    beforeEach(() => {
        vi.resetModules();
    });
    afterEach(() => {
        resetFakeYouTube();
        vi.restoreAllMocks();
    });

    it('injects the IFrame API script and creates the player once it loads', async () => {
        const previousReady = vi.fn();
        window.onYouTubeIframeAPIReady = previousReady;
        const { getByTestId } = await renderHookHost();

        apiScript();
        expect(FakePlayer.instances).toHaveLength(0);

        finishApiLoad();
        const player = await waitFor(latestPlayer);

        expect(previousReady).toHaveBeenCalled();
        expect(getByTestId('host')).toContainElement(player.target);
        expect(getByTestId('host')).toHaveAttribute('data-ready', 'false');

        act(() => player.ready());
        expect(getByTestId('host')).toHaveAttribute('data-ready', 'true');
    });

    it('forwards player events to the latest handlers', async () => {
        const onStateChange = vi.fn();
        const onError = vi.fn();
        await renderHookHost({ onStateChange, onError });
        finishApiLoad();
        const player = await waitFor(latestPlayer);

        player.stateChange(fakeYT.PlayerState.PLAYING);
        player.error(100 as YT.PlayerError);

        expect(onStateChange).toHaveBeenCalledWith(fakeYT.PlayerState.PLAYING);
        expect(onError).toHaveBeenCalledWith(100);
    });

    it('destroys the player and clears the container on unmount', async () => {
        const { getByTestId, unmount } = await renderHookHost();
        finishApiLoad();
        const player = await waitFor(latestPlayer);
        const host = getByTestId('host');

        unmount();

        expect(player.destroy).toHaveBeenCalled();
        expect(host).toBeEmptyDOMElement();
    });

    it('does not create a player if unmounted before the API loads', async () => {
        const { unmount } = await renderHookHost();
        unmount();

        finishApiLoad();
        await Promise.resolve();

        expect(FakePlayer.instances).toHaveLength(0);
    });

    it('logs and allows a retry when the API script fails to load', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { unmount } = await renderHookHost();

        apiScript().onerror?.(new Event('error'));
        await waitFor(() => expect(consoleError).toHaveBeenCalledWith(expect.any(Error)));
        unmount();
        apiScript().remove();

        await renderHookHost();
        expect(apiScript()).toBeInTheDocument();
    });
});
