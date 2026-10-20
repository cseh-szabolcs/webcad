import { describe, expect, it } from 'vitest';
import type { Point } from '../../model/Point';
import type { Rect } from '../../renderer/Viewport';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { buildElementShapes, type ElementShape } from './ElementShapes';
import { ShapeIndex } from './ShapeIndex';

const { element: E } = sampleIds;

const shapes = buildElementShapes(parseDocument(samplePlan));
const index = new ShapeIndex(shapes);
const ids = (found: ElementShape[]) => found.map((shape) => shape.id);

/** Deterministic pseudo-random numbers in [0, 1), so failures are reproducible. */
function random(seed: number): () => number {
    let state = seed;
    return () => {
        state = (state * 1664525 + 1013904223) % 2 ** 32;
        return state / 2 ** 32;
    };
}

function bruteForce(rect: Rect): ElementShape[] {
    return shapes.filter(
        ({ bounds: b }) =>
            b.x <= rect.x + rect.width && rect.x <= b.x + b.width && b.y <= rect.y + rect.height && rect.y <= b.y + b.height,
    );
}

describe('ShapeIndex', () => {
    it('finds the shapes whose bounds touch the rectangle, in drawing order', () => {
        // Around the table: its bounds and the rug's overlap, the sofa's do not
        expect(ids(index.search({ x: 3900, y: 1700, width: 200, height: 200 }))).toEqual([
            E['wall-outer'],
            E['wall-inner'],
            E.table,
            E.rug,
        ]);
    });

    it('counts touching edges as overlap', () => {
        // The table's bounds end at x 4600
        expect(ids(index.search({ x: 4600, y: 1800, width: 0, height: 0 }))).toContain(E.table);
    });

    it('returns everything for the whole plan', () => {
        expect(ids(index.search({ x: -1000, y: -1000, width: 8000, height: 6000 }))).toEqual(ids(shapes));
    });

    it('agrees with a brute-force search', () => {
        const next = random(42);
        const point = (): Point => ({ x: next() * 7000 - 500, y: next() * 5000 - 500 });
        for (let i = 0; i < 500; i++) {
            const a = point();
            const b = point();
            const rect = {
                x: Math.min(a.x, b.x),
                y: Math.min(a.y, b.y),
                width: Math.abs(a.x - b.x) * next(),
                height: Math.abs(a.y - b.y) * next(),
            };
            expect(ids(index.search(rect))).toEqual(ids(bruteForce(rect)));
        }
    });
});
