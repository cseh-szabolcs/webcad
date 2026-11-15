import { afterEach, describe, expect, it, vi } from 'vitest';
import { backendHost } from './backendHost';

function root(host?: string): HTMLElement {
    return { dataset: host === undefined ? {} : { backendHost: host } } as unknown as HTMLElement;
}

describe('backendHost', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('takes the host the page names, without a trailing slash', () => {
        vi.stubEnv('VITE_BACKEND_HOST', 'http://build.test');
        expect(backendHost(root('https://app.example.com/'))).toBe('https://app.example.com');
    });

    it('keeps an empty host of the page (same origin)', () => {
        vi.stubEnv('VITE_BACKEND_HOST', 'http://build.test');
        expect(backendHost(root(''))).toBe('');
    });

    it('falls back to the host of the build', () => {
        vi.stubEnv('VITE_BACKEND_HOST', 'http://localhost:8080');
        expect(backendHost(root())).toBe('http://localhost:8080');
        expect(backendHost(null)).toBe('http://localhost:8080');
    });
});
