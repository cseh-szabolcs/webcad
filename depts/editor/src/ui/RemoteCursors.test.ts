import { describe, expect, it } from 'vitest';
import { remoteCursorColor, remoteCursorPath } from './RemoteCursors';

describe('remoteCursorPath', () => {
    it('is a cross with an arm of the given length each way', () => {
        expect(remoteCursorPath(7)).toBe('M-7 0H7M0 -7V7');
    });
});

describe('remoteCursorColor', () => {
    it('names the token of the collaborator colour', () => {
        expect(remoteCursorColor(0)).toBe('var(--collab-color-0)');
        expect(remoteCursorColor(4)).toBe('var(--collab-color-4)');
    });

    it('repeats the palette beyond its size', () => {
        expect(remoteCursorColor(5)).toBe('var(--collab-color-0)');
        expect(remoteCursorColor(7)).toBe('var(--collab-color-2)');
        expect(remoteCursorColor(-1)).toBe('var(--collab-color-4)');
    });
});
