import { describe, expect, it } from 'vitest';
import { reflectionAcross, rotationAbout, scalingAbout } from '../../geometry/similarity';
import type { CadDocument } from '../../model/CadDocument';
import { vertexRefs } from '../../model/CadElement';
import type { Point } from '../../model/Point';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { TransformCommand } from './TransformCommand';

const { element: E, vertex: V } = sampleIds;

const doc = parseDocument(samplePlan);
/** Deterministic ids for vertex copies. */
const ids = () => {
    let n = 0;
    return () => `copy-${++n}`;
};
const element = (d: CadDocument, id: string) => d.elements.find((e) => e.id === id)!;
const vertex = (d: CadDocument, id: string): Point => {
    const { x, y } = d.vertices.find((v) => v.id === id)!;
    return { x: x + 0, y: y + 0 };
};
const HINGE = { x: 1000, y: 240 };

describe('TransformCommand', () => {
    it('rotates the elements about the point, a quarter turn exactly', () => {
        const command = new TransformCommand('GRIP_ROTATE', [E['door-leaf'], E['door-swing']], rotationAbout(HINGE, 90), ids());
        const { document, changedElementIds } = command.execute(doc);
        expect(vertex(document, V['d-hinge'])).toEqual(HINGE);
        expect(vertex(document, V['d-closed'])).toEqual({ x: 1000, y: 1140 });
        expect(vertex(document, V['d-open'])).toEqual({ x: 100, y: 240 });
        expect(element(document, E['door-swing'])).toMatchObject({ clockwise: false });
        expect(changedElementIds).toEqual([E['door-leaf'], E['door-swing']]);
        expect(command.label).toBe('GRIP_ROTATE');
    });

    it('scales positions and radii, and leaves the rotation of an ellipse', () => {
        const command = new TransformCommand('GRIP_SCALE', [E.table, E.rug], scalingAbout({ x: 4600, y: 1800 }, 2), ids());
        const { document } = command.execute(doc);
        expect(vertex(document, V['t-center'])).toEqual({ x: 3400, y: 1800 });
        expect(element(document, E.table)).toMatchObject({ radius: 1200 });
        expect(element(document, E.rug)).toMatchObject({ radiusX: 2000, radiusY: 1400, rotation: 0 });
    });

    it('turns the axis of an ellipse and the control points of a bezier with them', () => {
        const turned = new TransformCommand('GRIP_ROTATE', [E.rug, E.curtain], rotationAbout({ x: 0, y: 0 }, 90), ids()).execute(doc);
        expect(element(turned.document, E.rug)).toMatchObject({ radiusX: 1000, radiusY: 700, rotation: Math.PI / 2 });
        expect(element(turned.document, E.curtain)).toMatchObject({
            startControl: { x: 200, y: 500 },
            endControl: { x: 200, y: -500 },
        });
        expect(vertex(turned.document, V['c-1'])).toEqual({ x: -3700, y: 3500 });
    });

    it('mirrors across the line and turns arcs the other way round', () => {
        // Across the vertical through the hinge
        const mirror = reflectionAcross(HINGE, { x: 1000, y: 1000 })!;
        const elements = [E['door-leaf'], E['door-swing'], E.curtain];
        const { document } = new TransformCommand('GRIP_MIRROR', elements, mirror, ids()).execute(doc);
        expect(vertex(document, V['d-closed'])).toEqual({ x: 100, y: 240 });
        expect(vertex(document, V['d-open'])).toEqual({ x: 1000, y: 1140 });
        expect(element(document, E['door-swing'])).toMatchObject({ clockwise: true });
        expect(vertex(document, V['c-1'])).toEqual({ x: -1500, y: 3700 });
        const curtain = element(document, E.curtain) as { startControl: Point };
        expect({ x: curtain.startControl.x + 0, y: curtain.startControl.y + 0 }).toEqual({ x: -500, y: -200 });
    });

    it('leaves an element that is not transformed on a copy of the shared vertex', () => {
        // The axis ends on the inner wall corner w-i1
        const { document, changedElementIds } = new TransformCommand(
            'GRIP_SCALE',
            [E['wall-inner']],
            scalingAbout({ x: 0, y: 0 }, 2),
            ids(),
        ).execute(doc);
        expect(vertex(document, V['w-i1'])).toEqual({ x: 480, y: 480 });
        expect(vertexRefs(element(document, E.axis))).toEqual([V['w-o1'], 'copy-1']);
        expect(vertex(document, 'copy-1')).toEqual({ x: 240, y: 240 });
        expect(changedElementIds).toEqual([E['wall-inner'], E.axis]);
    });

    it('restores the document exactly on undo and repeats the result on redo', () => {
        const command = new TransformCommand('GRIP_ROTATE', [E['wall-inner'], E.rug, E.curtain], rotationAbout(HINGE, 33.3), ids());
        const first = command.execute(doc).document;
        const undone = command.undo(first).document;
        expect(undone).toEqual(doc);
        expect(command.execute(undone).document).toEqual(first);
    });
});
