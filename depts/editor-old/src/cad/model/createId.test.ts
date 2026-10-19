import { describe, expect, it } from 'vitest';
import { createId } from './createId';

describe('createId', () => {
    it('returns distinct lowercase version 4 UUIDs', () => {
        const ids = Array.from({ length: 100 }, createId);

        for (const id of ids) {
            expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        }
        expect(new Set(ids).size).toBe(ids.length);
    });
});
