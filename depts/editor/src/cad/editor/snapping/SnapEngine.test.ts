import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../../model/CadDocument';
import type { CadElement } from '../../model/CadElement';
import type { Point } from '../../model/Point';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { SnapEngine, SnapMemory, type SnapQuery, type SnapResult } from './SnapEngine';
import { SNAP_MODES, type SnapMode } from './SnapMode';

const { element: E, layer: L } = sampleIds;

const doc = parseDocument(samplePlan);
const engine = new SnapEngine(doc);
const ALL = new Set(SNAP_MODES);

/** One screen pixel is 1 mm, so the 10 px aperture reaches 10 mm on each side. */
const query = (cursor: Point, change: Partial<SnapQuery> = {}): SnapQuery => ({
    cursor,
    pixelSize: 1,
    aperture: 10,
    modes: ALL,
    ...change,
});
const round3 = (n: number) => Math.round(n * 1000) / 1000 + 0;
/** Mode and rounded point, for readable expectations. */
const snapped = (result: SnapResult | null) =>
    result && { mode: result.mode, x: round3(result.point.x), y: round3(result.point.y) };
const only = (...modes: SnapMode[]) => ({ modes: new Set(modes) });

const withLayer = (layerId: string, change: { visible?: boolean; locked?: boolean }): CadDocument => ({
    ...doc,
    layers: doc.layers.map((layer) => (layer.id === layerId ? { ...layer, ...change } : layer)),
});

/** Document with the given vertices (named by their ids) and elements, without layers. */
function drawing(vertices: Record<string, Point>, elements: Partial<CadElement>[]): CadDocument {
    return {
        ...doc,
        vertices: Object.entries(vertices).map(([id, p]) => ({ id, ...p })),
        elements: elements.map((element, i) => ({
            id: `e${i}`,
            layerId: null,
            groupId: null,
            styleId: null,
            ...element,
        })) as CadElement[],
        layers: [],
        groups: [],
    };
}

describe('SnapEngine: snap points', () => {
    it('snaps to the endpoint near the cursor', () => {
        expect(snapped(engine.find(query({ x: 6005, y: 3 })))).toEqual({ mode: 'END', x: 6000, y: 0 });
        expect(snapped(engine.find(query({ x: 6011, y: 3 })))).toBeNull();
    });

    it('snaps to the midpoint of a polyline edge', () => {
        expect(snapped(engine.find(query({ x: 3004, y: 2 })))).toEqual({ mode: 'MID', x: 3000, y: 0 });
    });

    it('takes the midpoint of an arc at its middle angle', () => {
        const r = 900 * Math.SQRT1_2;
        expect(snapped(engine.find(query({ x: 1000 + r + 3, y: 240 + r - 2 })))).toEqual({
            mode: 'MID',
            x: round3(1000 + r),
            y: round3(240 + r),
        });
    });

    it('takes the midpoint of a Bézier by arc length', () => {
        expect(snapped(engine.find(query({ x: 4253, y: 3552 })))).toEqual({ mode: 'MID', x: 4250, y: 3550 });
    });

    it('snaps to the quadrants of circles and ellipses', () => {
        expect(snapped(engine.find(query({ x: 4605, y: 1804 })))).toEqual({ mode: 'QUA', x: 4600, y: 1800 });
        expect(snapped(engine.find(query({ x: 4002, y: 2496 })))).toEqual({ mode: 'QUA', x: 4000, y: 2500 });
    });

    it('lets an endpoint win over a quadrant at the same place', () => {
        // The door swing runs from 0° to 90°, so both its ends are quadrant points too
        expect(snapped(engine.find(query({ x: 1004, y: 1136 }), new SnapMemory()))).toEqual({
            mode: 'END',
            x: 1000,
            y: 1140,
        });
    });
});

describe('SnapEngine: centre', () => {
    const onTable = { x: 4000 + 600 * Math.SQRT1_2, y: 1800 + 600 * Math.SQRT1_2 };

    it('never pulls the snap from the curve to the far centre', () => {
        expect(engine.find(query(onTable))).toBeNull();
        // Just outside the aperture of the table's left quadrant (3400, 1800), still on the circle
        const nearQuadrant = { x: 4000 - 600 * Math.cos(0.022), y: 1800 + 600 * Math.sin(0.022) };
        expect(engine.find(query(nearQuadrant))).toBeNull();
        // On the rug's outline
        expect(engine.find(query({ x: 4000 + 1000 * Math.SQRT1_2, y: 1800 + 700 * Math.SQRT1_2 }))).toBeNull();
    });

    it('snaps on the centre only after the curve was touched in this prompt', () => {
        const memory = new SnapMemory();
        expect(engine.find(query({ x: 4003, y: 1802 }), memory)).toBeNull();
        engine.find(query(onTable), memory);
        const result = engine.find(query({ x: 4003, y: 1802 }), memory);
        expect(snapped(result)).toEqual({ mode: 'CEN', x: 4000, y: 1800 });
        expect(result?.elementIds).toEqual([E.table]);
    });

    it('snaps to the quadrant near the curve', () => {
        expect(snapped(engine.find(query({ x: 4600, y: 1806 })))).toEqual({ mode: 'QUA', x: 4600, y: 1800 });
    });
});

describe('SnapEngine: intersections', () => {
    it('merges an intersection with a coinciding endpoint', () => {
        // The door hinge lies on the inner wall: endpoint of the leaf and intersection with the wall
        const result = engine.find(query({ x: 1003, y: 243 }));
        expect(snapped(result)).toEqual({ mode: 'END', x: 1000, y: 240 });
        expect(result?.elementIds).toEqual(expect.arrayContaining([E['door-leaf'], E['wall-inner']]));
    });

    it('finds the corner of a polyline as intersection when endpoints are off', () => {
        expect(snapped(engine.find(query({ x: 6005, y: 3 }, only('INT'))))).toEqual({ mode: 'INT', x: 6000, y: 0 });
    });

    it('intersects segments, circles and arcs exactly', () => {
        const engine = new SnapEngine(
            drawing({ a: { x: -100, y: 30 }, b: { x: 100, y: 30 }, c: { x: 0, y: 0 } }, [
                { type: 'line', startVertexId: 'a', endVertexId: 'b' },
                { type: 'circle', centerVertexId: 'c', radius: 50 },
            ]),
        );
        expect(snapped(engine.find(query({ x: 42, y: 27 })))).toEqual({ mode: 'INT', x: 40, y: 30 });
    });

    it('intersects Béziers and ellipses numerically', () => {
        const engine = new SnapEngine(
            drawing(
                {
                    a: { x: 0, y: -100 },
                    b: { x: 0, y: 100 },
                    s: { x: -100, y: 0 },
                    e: { x: 100, y: 0 },
                    c: { x: 0, y: 0 },
                },
                [
                    { type: 'line', startVertexId: 'a', endVertexId: 'b' },
                    // Symmetric hump: crosses x = 0 at its top, y = 0.75 · 80 = 60
                    { type: 'bezier', startVertexId: 's', endVertexId: 'e', startControl: { x: 50, y: 80 }, endControl: { x: -50, y: 80 } },
                    { type: 'ellipse', centerVertexId: 'c', radiusX: 80, radiusY: 70 },
                ],
            ),
        );
        expect(snapped(engine.find(query({ x: 3, y: 58 }, only('INT'))))).toEqual({ mode: 'INT', x: 0, y: 60 });
        expect(snapped(engine.find(query({ x: 2, y: -67 }, only('INT'))))).toEqual({ mode: 'INT', x: 0, y: -70 });
        // Bézier and ellipse: the exact point satisfies both curves
        const hit = engine.find(query({ x: 66, y: 32 }, only('INT')))!.point;
        expect((hit.x / 80) ** 2 + (hit.y / 70) ** 2).toBeCloseTo(1, 9);
        expect(hit.x).toBeCloseTo(69.32, 1);
    });
});

describe('SnapEngine: priority and settings', () => {
    const short = new SnapEngine(
        drawing({ a: { x: 0, y: 0 }, b: { x: 6, y: 0 } }, [{ type: 'line', startVertexId: 'a', endVertexId: 'b' }]),
    );

    it('picks the nearest point, an endpoint when about as near as a midpoint', () => {
        expect(snapped(short.find(query({ x: 2, y: 0 })))).toEqual({ mode: 'END', x: 0, y: 0 });
        expect(snapped(short.find(query({ x: 3, y: 0 })))).toEqual({ mode: 'MID', x: 3, y: 0 });
    });

    it('only uses the enabled modes', () => {
        expect(snapped(short.find(query({ x: 2, y: 0 }, only('MID'))))).toEqual({ mode: 'MID', x: 3, y: 0 });
        expect(short.find(query({ x: 2, y: 0 }, only()))).toBeNull();
    });

    it('keeps the aperture at the same screen size at every zoom', () => {
        expect(engine.find(query({ x: 6015, y: 0 }))).toBeNull();
        expect(snapped(engine.find(query({ x: 6015, y: 0 }, { pixelSize: 2 })))).toEqual({ mode: 'END', x: 6000, y: 0 });
    });

    it('skips hidden layers but snaps to locked ones', () => {
        expect(new SnapEngine(withLayer(L.walls, { visible: false })).find(query({ x: 6005, y: 3 }))).toBeNull();
        expect(snapped(new SnapEngine(withLayer(L.furniture, { locked: true })).find(query({ x: 4605, y: 1804 })))).toEqual({
            mode: 'QUA',
            x: 4600,
            y: 1800,
        });
    });
});
