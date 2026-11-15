import { afterEach, describe, expect, it, vi } from 'vitest';
import { backendHost, exitUrl } from './backendHost';

function root(host?: string, exitPath?: string): HTMLElement {
    const dataset: Record<string, string> = {};
    if (host !== undefined) dataset.backendHost = host;
    if (exitPath !== undefined) dataset.exitPath = exitPath;
    return { dataset } as unknown as HTMLElement;
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

describe('exitUrl', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('leads to the path the page names on the backend host', () => {
        expect(exitUrl(root('http://localhost:8080/', '/en/plans'))).toBe('http://localhost:8080/en/plans');
    });

    it('falls back to the German plan list', () => {
        vi.stubEnv('VITE_BACKEND_HOST', '');
        expect(exitUrl(root())).toBe('/de/plans');
        expect(exitUrl(null)).toBe('/de/plans');
    });
});
