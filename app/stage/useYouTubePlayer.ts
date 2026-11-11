import { useEffect, useRef, useState } from "react";

declare global {
    interface Window {
        YT?: typeof YT;
        onYouTubeIframeAPIReady?: () => void;
    }
}

let apiPromise: Promise<typeof YT> | null = null;

function loadYouTubeApi(): Promise<typeof YT> {
    if (apiPromise) return apiPromise;
    apiPromise = new Promise<typeof YT>((resolve, reject) => {
        if (window.YT?.Player) return resolve(window.YT);
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            previous?.();
            resolve(window.YT!);
        };
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.onerror = () => {
            apiPromise = null;
            reject(new Error("YouTube IFrame API failed to load"));
        };
        document.head.append(script);
    });
    return apiPromise;
}

export interface YouTubePlayerHandlers {
    onStateChange?: (state: YT.PlayerState) => void;
    onError?: (code: YT.PlayerError) => void;
}

export function useYouTubePlayer(handlers: YouTubePlayerHandlers) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YT.Player | null>(null);
    const handlersRef = useRef(handlers);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        handlersRef.current = handlers;
    });

    useEffect(() => {
        const host = containerRef.current;
        if (!host) return;
        let cancelled = false;
        let player: YT.Player | null = null;

        const target = document.createElement("div");
        host.append(target);

        loadYouTubeApi()
            .then((api) => {
                if (cancelled) return;
                player = new api.Player(target, {
                    width: "100%",
                    height: "100%",
                    playerVars: {
                        autoplay: 0,
                        controls: 0,
                        rel: 0,
                        playsinline: 1,
                        iv_load_policy: 3,
                        origin: window.location.origin,
                    },
                    events: {
                        onReady: () => {
                            playerRef.current = player;
                            setReady(true);
                        },
                        onStateChange: (e) =>
                            handlersRef.current.onStateChange?.(e.data),
                        onError: (e) => handlersRef.current.onError?.(e.data),
                    },
                });
            })
            .catch((err) => console.error(err));

        return () => {
            cancelled = true;
            player?.destroy();
            playerRef.current = null;
            setReady(false);
            host.replaceChildren();
        };
    }, []);

    return { containerRef, player: playerRef, ready };
}
