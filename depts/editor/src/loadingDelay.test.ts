import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadingDelay } from './loadingDelay';

function root(delay?: string): HTMLElement {
    return { dataset: delay === undefined ? {} : { loadingDelay: delay } } as unknown as HTMLElement;
}

describe('loadingDelay', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('takes the delay the page names', () => {
        vi.stubEnv('VITE_LOADING_DELAY_MS', '500');
        expect(loadingDelay(root('1500'))).toBe(1500);
    });

    it('falls back to the delay of the build, else none', () => {
        vi.stubEnv('VITE_LOADING_DELAY_MS', '800');
        expect(loadingDelay(root())).toBe(800);
        expect(loadingDelay(root(''))).toBe(800);
        vi.stubEnv('VITE_LOADING_DELAY_MS', '');
        expect(loadingDelay(null)).toBe(0);
    });

    it('ignores what is no positive number', () => {
        vi.stubEnv('VITE_LOADING_DELAY_MS', '');
        expect(loadingDelay(root('abc'))).toBe(0);
        expect(loadingDelay(root('-200'))).toBe(0);
    });
});
