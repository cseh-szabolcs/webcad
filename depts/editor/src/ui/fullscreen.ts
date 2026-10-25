import { useCallback, useEffect, useState } from 'react';

/**
 * Fullscreen of the whole editor page through the browser's Fullscreen API. `active` follows
 * the browser, so leaving it with Esc (or the browser's own controls) is picked up too.
 * `supported` is false where the page may not go fullscreen (e.g. an iframe without permission).
 */
export function useFullscreen(): { supported: boolean; active: boolean; toggle: () => void } {
    const [active, setActive] = useState(() => document.fullscreenElement !== null);

    useEffect(() => {
        const onChange = () => setActive(document.fullscreenElement !== null);
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    const toggle = useCallback(() => {
        // Rejected e.g. without a user gesture; the state then simply stays as it is
        const request =
            document.fullscreenElement === null ? document.documentElement.requestFullscreen() : document.exitFullscreen();
        request.catch(() => {});
    }, []);

    return { supported: document.fullscreenEnabled, active, toggle };
}
