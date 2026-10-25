import { useCallback, useEffect, useState } from 'react';

/** The Keyboard Lock API (Chromium only), not yet in TypeScript's DOM types. */
interface KeyboardLock {
    lock(keyCodes?: string[]): Promise<void>;
}

function keyboardLock(): KeyboardLock | undefined {
    const keyboard = (navigator as Navigator & { keyboard?: Partial<KeyboardLock> }).keyboard;
    return typeof keyboard?.lock === 'function' ? (keyboard as KeyboardLock) : undefined;
}

/**
 * Fullscreen of the whole editor page through the browser's Fullscreen API. While it is on,
 * Esc is locked with the Keyboard Lock API, so the editor gets it (cancelling commands) and
 * the user leaves fullscreen by holding Esc instead; the browser releases the lock when
 * fullscreen ends. `active` follows the browser, so leaving it with held Esc (or the
 * browser's own controls) is picked up too. `supported` is false where the page may not go
 * fullscreen (e.g. an iframe without permission). `lockable` is false where the browser cannot
 * lock Esc (Safari, Firefox): `toggle` then does nothing, as a plain Esc would end fullscreen
 * in the middle of the work.
 */
export function useFullscreen(): { supported: boolean; lockable: boolean; active: boolean; toggle: () => void } {
    const [active, setActive] = useState(() => document.fullscreenElement !== null);

    useEffect(() => {
        const onChange = () => setActive(document.fullscreenElement !== null);
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    const toggle = useCallback(() => {
        const lock = keyboardLock();
        if (document.fullscreenElement !== null) {
            document.exitFullscreen().catch(() => {});
        } else if (lock !== undefined) {
            // Rejected e.g. without a user gesture; the state then simply stays as it is.
            // Without the Esc lock fullscreen is left again rather than ending on the next Esc.
            document.documentElement
                .requestFullscreen()
                .then(() => lock.lock(['Escape']).catch(() => document.exitFullscreen()))
                .catch(() => {});
        }
    }, []);

    return { supported: document.fullscreenEnabled, lockable: keyboardLock() !== undefined, active, toggle };
}
