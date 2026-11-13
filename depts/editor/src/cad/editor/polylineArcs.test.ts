import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../model/CadDocument';
import type { PolylineElement } from '../model/CadElement';
import { indexDocument } from '../model/DocumentIndex';
import type { Point } from '../model/Point';
import { CadDocumentError, parseDocument } from '../persistence/CadSerializer';
import { buildPathSpec } from '../renderer/PathSpec';
import { flattenPathSpec } from '../geometry/flatten';
import { reflectionAcross, rotationAbout } from '../geometry/similarity';
import samplePlan from '../__fixtures__/sample-plan.json';
import { sampleIds } from '../__fixtures__/sampleIds';
import { AddPolylineVertexCommand, RemovePolylineVertexCommand, SetPolylineBulgeCommand } from './commands/PolylineVertexCommands';
import { transformElement } from './commands/TransformCommand';
import { stretchTargets } from './grips/stretch';
import { elementGrips } from './selection/grips';
import { elementPrimitives, elementSnapPoints } from './snapping/SnapGeometry';
import { continueFrom } from './tools/DrawingMemory';

const { element: E, vertex: V } = sampleIds;

/**
 * The sample plan with the sofa's lower edge, (600,2600) to (2600,2600), as an arc with a bulge of
 * 0.5: counter-clockwise through (1600,2100), around (1600,3350) with a radius of 1250.
 */
const withSofa = (change: Partial<PolylineElement>): CadDocument => {
    const doc = parseDocument(samplePlan);
    return { ...doc, elements: doc.elements.map((e) => (e.id === E.sofa ? ({ ...e, ...change } as PolylineElement) : e)) };
};
const doc = withSofa({ bulges: [0.5, 0, 0, 0] });
const index = indexDocument(doc);
const sofaOf = (d: CadDocument) => d.elements.find((e) => e.id === E.sofa) as PolylineElement;
const sofa = sofaOf(doc);
const ARC_MID = { x: 1600, y: 2100 };
const near = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;

describe('a polyline with an arc segment', () => {
    it('is drawn along the arc, between the vertices themselves', () => {
        const spec = buildPathSpec(sofa, index);
        expect(spec.closed).toBe(true);
        // The arc spans more than a quarter, so a point lies between its ends
        expect(spec.segments.map((segment) => segment.point)).toHaveLength(5);
        expect(spec.segments[0]).toMatchObject({ point: { x: 600, y: 2600 } });
        expect(spec.segments[0].handleOut).toBeDefined();
        expect(spec.segments[0].handleIn).toBeUndefined();
        expect(near(spec.segments[1].point, ARC_MID)).toBe(true);
        expect(spec.segments[2]).toMatchObject({ point: { x: 2600, y: 2600 } });
        expect(spec.segments[2].handleIn).toBeDefined();
        expect(spec.segments[2].handleOut).toBeUndefined();
        // Its outline, which picking uses, follows the arc
        const outline = flattenPathSpec(spec, 1);
        expect(Math.min(...outline.map((point) => point.y))).toBeCloseTo(2100, 0);
    });

    it('snaps like an arc there: centre, ends, middle, and the centroid of the whole outline', () => {
        const [arc, edge] = elementPrimitives(sofa, index);
        expect(arc).toMatchObject({ kind: 'arc', center: { x: 1600, y: 3350 }, radius: 1250 });
        expect(edge).toMatchObject({ kind: 'segment', a: { x: 2600, y: 2600 }, b: { x: 2600, y: 3500 } });
        const [plain] = elementSnapPoints(sofaOf(parseDocument(samplePlan)), index);
        const [centroid] = elementSnapPoints(sofa, index);
        expect(plain.point).toEqual({ x: 1600, y: 3050 });
        expect(centroid.mode).toBe('GCE');
        expect(centroid.point.x).toBeCloseTo(1600, 3);
        expect(centroid.point.y).toBeLessThan(3000);
    });

    it('has the grip of the segment on the arc, and stretching it bends the arc between its ends', () => {
        const grip = elementGrips(sofa, index).find((candidate) => near(candidate.point, ARC_MID))!;
        expect(grip.targets[0].part).toEqual({ kind: 'segment', index: 0 });
        const [edit] = stretchTargets(index, [grip], { x: 0, y: -500 })!;
        // Down to half the length of the chord: half a circle
        expect((edit.element as PolylineElement).bulges[0]).toBeCloseTo(1);
        expect(edit.vertices.size).toBe(0);
        // Onto the chord it is straight again; a straight segment still moves both its ends
        const [flat] = stretchTargets(index, [grip], { x: 0, y: 500 })!;
        expect((flat.element as PolylineElement).bulges[0]).toBe(0);
        const side = elementGrips(sofa, index).find((candidate) => near(candidate.point, { x: 2600, y: 3050 }))!;
        const [moved] = stretchTargets(index, [side], { x: 100, y: 0 })!;
        expect([...moved.vertices.keys()]).toEqual([V['s-2'], V['s-3']]);
        expect((moved.element as PolylineElement).bulges).toEqual([0.5, 0, 0, 0]);
    });

    it('keeps its bulges when turned, and turns its arcs the other way when mirrored', () => {
        expect((transformElement(sofa, index, rotationAbout({ x: 0, y: 0 }, 37)).element as PolylineElement).bulges).toEqual([0.5, 0, 0, 0]);
        const mirror = reflectionAcross({ x: 0, y: 0 }, { x: 1, y: 0 })!;
        expect((transformElement(sofa, index, mirror).element as PolylineElement).bulges).toEqual([-0.5, 0, 0, 0]);
    });

    it('makes the segments at a vertex added or removed straight, and undo brings the arc back', () => {
        const add = new AddPolylineVertexCommand(E.sofa, 1, { x: 1600, y: 2300 }, () => 'new');
        const added = add.execute(doc).document;
        expect(sofaOf(added).bulges).toEqual([0, 0, 0, 0, 0]);
        expect(add.undo(added).document).toEqual(doc);
        // Elsewhere the arc stays
        const other = new AddPolylineVertexCommand(E.sofa, 3, { x: 1600, y: 3600 }, () => 'new');
        expect(sofaOf(other.execute(doc).document).bulges).toEqual([0.5, 0, 0, 0, 0]);
        const remove = new RemovePolylineVertexCommand(E.sofa, 1);
        const removed = remove.execute(doc).document;
        expect(sofaOf(removed).bulges).toEqual([0, 0, 0]);
        expect(remove.undo(removed).document).toEqual(doc);
    });

    it('sets the bulge of one segment, named after what it makes of it', () => {
        const toLine = new SetPolylineBulgeCommand(E.sofa, 0, 0);
        expect(toLine.label).toBe('GRIP_CONVERT_LINE');
        const straight = toLine.execute(doc);
        expect(sofaOf(straight.document).bulges).toEqual([0, 0, 0, 0]);
        expect(straight.changedElementIds).toEqual([E.sofa]);
        expect(toLine.undo(straight.document).document).toEqual(doc);
        const toArc = new SetPolylineBulgeCommand(E.sofa, 2, -1);
        expect(toArc.label).toBe('GRIP_CONVERT_ARC');
        expect(sofaOf(toArc.execute(doc).document).bulges).toEqual([0.5, 0, -1, 0]);
        // A segment the polyline does not have
        const none = new SetPolylineBulgeCommand(E.sofa, 9, 1).execute(doc);
        expect(none.document.elements).toEqual(doc.elements);
    });

    it('is continued along its last arc', () => {
        // Closed: the closing segment, straight down the left side
        expect(continueFrom(doc, E.sofa)).toMatchObject({ point: { x: 600, y: 2600 }, curved: false });
        // Open, ending with half a circle from the right to the left: it arrives heading down
        const open = withSofa({ closed: false, bulges: [0, 0, 1, 0] });
        const last = continueFrom(open, E.sofa)!;
        expect(last).toMatchObject({ point: { x: 600, y: 3500 }, curved: true });
        expect(Math.sin(last.direction)).toBeCloseTo(-1);
    });

    it('needs one bulge per vertex in a document', () => {
        const json = structuredClone(samplePlan) as { elements: Record<string, unknown>[] };
        const first = json.elements.find((element) => element.id === E.sofa)!;
        first.bulges = [0, 0.5];
        expect(() => parseDocument(json)).toThrow(CadDocumentError);
        delete first.bulges;
        expect(() => parseDocument(json)).toThrow(CadDocumentError);
        first.bulges = [0, 0.5, 0, -2];
        expect(sofaOf(parseDocument(json)).bulges).toEqual([0, 0.5, 0, -2]);
    });
});
