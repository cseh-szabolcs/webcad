import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../../model/CadDocument';
import type { ArcElement } from '../../model/CadElement';
import type { Point } from '../../model/Point';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import type { EditorPointerEvent } from '../EditorPointerEvent';
import { DocumentHistory } from '../commands/DocumentHistory';
import { SelectionEditor } from '../SelectionEditor';
import { DEFAULT_DYNAMIC_INPUT_SETTINGS } from '../../../settings/editorSettings';

const { element: E } = sampleIds;

/** One screen pixel is 2 mm (Y flipped), so the 10 px aperture reaches 20 mm. */
const at = (modelPoint: Point, change: Partial<EditorPointerEvent> = {}): EditorPointerEvent => ({
    viewPoint: { x: modelPoint.x / 2, y: -modelPoint.y / 2 },
    modelPoint,
    pixelSize: 2,
    button: 0,
    shiftKey: false,
    altKey: false,
    ...change,
});
/** Empty space between the door, the sofa and the rug, where nothing snaps: a half circle over A–C through B. */
const A = { x: 1500, y: 1500 };
const B = { x: 2000, y: 2000 };
const C = { x: 2500, y: 1500 };
const CENTER = { x: 2000, y: 1500 };

const START_PROMPT = 'Startpunkt für Bogen angeben:';
const SECOND_PROMPT = 'Zweiten Punkt für Bogen angeben oder [Zentrum]:';
const END_PROMPT = 'Endpunkt für Bogen angeben:';
const CENTER_PROMPT = 'Mittelpunkt für Bogen angeben:';
const DIRECTION_PROMPT = 'Endpunkt für Bogen angeben (Strg wechselt die Richtung) oder [Winkel]:';
const ANGLE_PROMPT = 'Eingeschlossenen Winkel angeben (Strg wechselt die Richtung):';
const ANGLE_INVALID = 'Winkel darf nicht 0 oder ein Vielfaches von 360 sein.';

/** Without Dynamic Input, so typed coordinates are absolute. */
const setup = () => {
    const history = new DocumentHistory(parseDocument(samplePlan));
    const editor = new SelectionEditor(history);
    editor.setDynamicInputSettings({ ...DEFAULT_DYNAMIC_INPUT_SETTINGS, enabled: false });
    return { editor, history, arcs: () => newArcs(history.document) };
};
const click = (editor: SelectionEditor, point: Point) => {
    editor.pointerMove(at(point));
    editor.pointerDown(at(point));
    editor.pointerUp(at(point));
};
/** Types text and ends it with Enter. */
const type = (editor: SelectionEditor, text: string) => {
    for (const key of text) {
        editor.keyDown({ key });
    }
    editor.keyDown({ key: 'Enter' });
};
const round = (n: number) => Math.round(n * 1000) / 1000 + 0;
const sampleIdsSet = new Set<string>(Object.values(E));
/** Arcs that are not in the sample plan, with the positions of their vertices (rounded). */
function newArcs(doc: CadDocument): { center: Point; start: Point; end: Point; clockwise: boolean }[] {
    const position = (id: string) => {
        const { x, y } = doc.vertices.find((v) => v.id === id)!;
        return { x: round(x), y: round(y) };
    };
    return doc.elements
        .filter((element): element is ArcElement => element.type === 'arc' && !sampleIdsSet.has(element.id))
        .map((arc) => ({
            center: position(arc.centerVertexId),
            start: position(arc.startVertexId),
            end: position(arc.endVertexId),
            clockwise: arc.clockwise,
        }));
}

/** The preview of the running command at a point. */
const previewAt = (editor: SelectionEditor, point: Point) => {
    const { preview } = editor.snapshot;
    if (typeof preview !== 'object' || preview?.kind !== 'curve') {
        throw new Error('no curve preview');
    }
    return preview.curveAt(point);
};

describe('ArcTool (BOGEN)', () => {
    it('starts by name or alias and drops the pickfirst selection', () => {
        for (const name of ['B', 'bogen', 'A', 'ARC']) {
            const { editor } = setup();
            click(editor, { x: 3000, y: 0 });
            expect(editor.snapshot.highlighted.size).toBe(1);
            type(editor, name);
            expect(editor.snapshot).toMatchObject({ command: 'ARC', prompt: START_PROMPT, cursor: 'point', grips: [], from: null });
            expect(editor.snapshot.highlighted.size).toBe(0);
        }
    });

    it('asks for three points, previews the arc at the last one and adds it as one undo step', () => {
        const { editor, arcs, history } = setup();
        const before = history.document;
        editor.startCommand('ARC');
        click(editor, A);
        // Two points give no arc yet: only the rubber band
        expect(editor.snapshot).toMatchObject({ prompt: SECOND_PROMPT, from: A, preview: { kind: 'curve', rubberBand: true } });
        click(editor, B);
        const { preview } = editor.snapshot;
        expect(editor.snapshot).toMatchObject({ prompt: END_PROMPT, from: B, preview: { kind: 'curve', rubberBand: false } });
        if (typeof preview !== 'object' || preview?.kind !== 'curve') {
            throw new Error('no curve preview');
        }
        expect(preview.curveAt(C)).toEqual({ kind: 'arc', center: CENTER, start: A, end: C, clockwise: true });
        // On the line through the first two points there is none
        expect(preview.curveAt({ x: 2500, y: 2500 })).toBeNull();
        expect(history.document).toBe(before);
        click(editor, C);
        expect(arcs()).toEqual([{ center: CENTER, start: A, end: C, clockwise: true }]);
        expect(editor.snapshot).toMatchObject({ command: null, prompt: 'Befehl:', canUndo: true });
        expect(history.document.elements.at(-1)).toMatchObject({ type: 'arc', name: null, layerId: null, groupId: null, styleId: null });
        expect(history.document.vertices).toHaveLength(before.vertices.length + 3);
        expect(editor.undo()).toBe(true);
        expect(history.document.vertices).toEqual(before.vertices);
        expect(arcs()).toEqual([]);
        expect(editor.snapshot.message).toBe('Rückgängig: BOGEN');
        expect(editor.redo()).toBe(true);
        expect(arcs()).toEqual([{ center: CENTER, start: A, end: C, clockwise: true }]);
    });

    it('runs from the start through the second point, in either direction', () => {
        const { editor, arcs } = setup();
        editor.startCommand('ARC');
        for (const point of ['2500,1500', '2000,2000', '1500,1500']) {
            type(editor, point);
        }
        // The same ends, but through the point below them
        editor.startCommand('ARC');
        for (const point of ['1500,1500', '2000,1000', '2500,1500']) {
            type(editor, point);
        }
        // A flat arc: its centre lies far off
        editor.startCommand('ARC');
        for (const point of ['1500,1500', '2000,1600', '2500,1500']) {
            type(editor, point);
        }
        expect(arcs()).toEqual([
            { center: CENTER, start: C, end: A, clockwise: false },
            { center: CENTER, start: A, end: C, clockwise: false },
            { center: { x: 2000, y: 300 }, start: A, end: C, clockwise: true },
        ]);
    });

    it('measures typed points from the point before', () => {
        const { editor, arcs } = setup();
        editor.startCommand('ARC');
        type(editor, '1500,1500');
        type(editor, '@500,500');
        type(editor, '@500<-45');
        const [arc] = arcs();
        expect(arc).toMatchObject({ start: A, clockwise: true });
        expect(arc.end).toEqual({ x: round(2000 + 500 * Math.SQRT1_2), y: round(2000 - 500 * Math.SQRT1_2) });
    });

    it('ignores points that give no arc', () => {
        const { editor, arcs } = setup();
        editor.startCommand('ARC');
        type(editor, '1500,1500');
        type(editor, '1500,1500');
        expect(editor.snapshot).toMatchObject({ prompt: SECOND_PROMPT, from: A });
        type(editor, '2000,2000');
        // The start, the second point and a point on their line
        for (const point of ['1500,1500', '2000,2000', '2500,2500']) {
            type(editor, point);
            expect(editor.snapshot).toMatchObject({ command: 'ARC', prompt: END_PROMPT, from: B });
        }
        expect(arcs()).toEqual([]);
        type(editor, '2500,1500');
        expect(arcs()).toHaveLength(1);
    });

    it('knows the option "Zentrum" only at the second point, and Enter alone gives no point', () => {
        const { editor } = setup();
        editor.startCommand('ARC');
        for (const text of ['', 'Z', 'x']) {
            type(editor, text);
            expect(editor.snapshot).toMatchObject({ prompt: START_PROMPT, message: 'Punkt oder Option-Schlüsselwort erforderlich.' });
        }
        type(editor, '1500,1500');
        for (const text of ['', 'E', 'x']) {
            type(editor, text);
            expect(editor.snapshot).toMatchObject({ prompt: SECOND_PROMPT, message: 'Punkt oder Option-Schlüsselwort erforderlich.' });
        }
        type(editor, '2000,2000');
        type(editor, 'Z');
        expect(editor.snapshot).toMatchObject({ prompt: END_PROMPT, message: 'Punkt oder Option-Schlüsselwort erforderlich.' });
        // Ctrl means nothing where three points give the direction
        expect(editor.keyDown({ key: 'Control' })).toBe(false);
    });

    it('ends with Esc at every prompt, without an arc', () => {
        const { editor, arcs, history } = setup();
        const before = history.document;
        for (const points of [[], ['1500,1500'], ['1500,1500', '2000,2000']]) {
            editor.startCommand('ARC');
            points.forEach((point) => type(editor, point));
            editor.keyDown({ key: 'Escape' });
            expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*' });
        }
        expect(arcs()).toEqual([]);
        expect(history.document).toBe(before);
    });

    it('snaps its points to objects and repeats with Enter at "Befehl:"', () => {
        const { editor, arcs } = setup();
        editor.startCommand('ARC');
        // The end of the door leaf
        click(editor, { x: 1004, y: 1136 });
        expect(editor.snapshot.from).toEqual({ x: 1000, y: 1140 });
        type(editor, '2000,2000');
        type(editor, '2500,1500');
        expect(arcs()).toMatchObject([{ start: { x: 1000, y: 1140 }, end: C }]);
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot).toMatchObject({ command: 'ARC', prompt: START_PROMPT });
    });

    it('adds an arc like any other: it is picked on its outline, shows its grips and snaps at its ends', () => {
        const { editor, history } = setup();
        editor.startCommand('ARC');
        for (const point of ['1500,1500', '2000,2000', '2500,1500']) {
            type(editor, point);
        }
        const arc = history.document.elements.at(-1)!;
        click(editor, B);
        expect([...editor.snapshot.highlighted]).toEqual([arc.id]);
        expect(editor.snapshot.grips.map((grip) => grip.point)).toEqual(expect.arrayContaining([CENTER, A, B, C]));
        editor.keyDown({ key: 'Escape' });
        editor.startCommand('LINE');
        click(editor, { x: 2504, y: 1496 });
        expect(editor.snapshot.from).toEqual(C);
    });

    describe('start, centre, end', () => {
        it('takes the centre with the option "Zentrum", then where the arc ends, counter-clockwise', () => {
            const { editor, arcs, history } = setup();
            const before = history.document;
            editor.startCommand('ARC');
            type(editor, '2500,1500');
            type(editor, 'z');
            // Only the rubber band from the start
            expect(editor.snapshot).toMatchObject({ prompt: CENTER_PROMPT, from: C, preview: { kind: 'curve', rubberBand: true } });
            expect(previewAt(editor, CENTER)).toBeNull();
            type(editor, '2000,1500');
            expect(editor.snapshot).toMatchObject({ prompt: DIRECTION_PROMPT, from: CENTER, preview: { kind: 'curve', rubberBand: true } });
            // The point only gives the direction: the arc ends on its circle
            expect(previewAt(editor, { x: 2000, y: 2300 })).toEqual({ kind: 'arc', center: CENTER, start: C, end: B, clockwise: false });
            expect(history.document).toBe(before);
            type(editor, '2000,2300');
            expect(arcs()).toEqual([{ center: CENTER, start: C, end: B, clockwise: false }]);
            expect(editor.snapshot).toMatchObject({ command: null, prompt: 'Befehl:' });
            expect(editor.undo()).toBe(true);
            expect(history.document.vertices).toEqual(before.vertices);
            expect(editor.snapshot.message).toBe('Rückgängig: BOGEN');
        });

        it('asks for the centre straight after the start when started with the method', () => {
            const { editor, arcs } = setup();
            editor.startCommand('ARC', 'startCenterEnd');
            expect(editor.snapshot).toMatchObject({ command: 'ARC', prompt: START_PROMPT });
            click(editor, C);
            expect(editor.snapshot).toMatchObject({ prompt: CENTER_PROMPT, from: C });
            click(editor, CENTER);
            // Below the centre: three quarters of the circle, counter-clockwise
            click(editor, { x: 2000, y: 1200 });
            expect(arcs()).toEqual([{ center: CENTER, start: C, end: { x: 2000, y: 1000 }, clockwise: false }]);
        });

        it('switches the direction with Ctrl, in the preview and for the arc, and keeps what was typed', () => {
            const { editor, arcs } = setup();
            editor.startCommand('ARC', 'startCenterEnd');
            type(editor, '2500,1500');
            // Ctrl means nothing before the end is asked for
            expect(editor.keyDown({ key: 'Control' })).toBe(false);
            type(editor, '2000,1500');
            const { prompt } = editor.snapshot;
            editor.keyDown({ key: '2' });
            expect(editor.keyDown({ key: 'Control' })).toBe(true);
            expect(editor.snapshot).toMatchObject({ prompt, input: '2', from: CENTER });
            expect(previewAt(editor, { x: 2000, y: 2300 })).toMatchObject({ end: B, clockwise: true });
            editor.keyDown({ key: 'Control' });
            expect(previewAt(editor, { x: 2000, y: 2300 })).toMatchObject({ clockwise: false });
            editor.keyDown({ key: 'Control' });
            for (const key of '000,2300') {
                editor.keyDown({ key });
            }
            editor.keyDown({ key: 'Enter' });
            expect(arcs()).toEqual([{ center: CENTER, start: C, end: B, clockwise: true }]);
            // The next arc is counter-clockwise again
            editor.startCommand('ARC', 'startCenterEnd');
            for (const point of ['2500,1500', '2000,1500', '2000,2300']) {
                type(editor, point);
            }
            expect(arcs()[1].clockwise).toBe(false);
        });

        it('ignores points that give no arc', () => {
            const { editor, arcs } = setup();
            editor.startCommand('ARC', 'startCenterEnd');
            type(editor, '2500,1500');
            // The centre on the start has no radius
            type(editor, '2500,1500');
            expect(editor.snapshot).toMatchObject({ prompt: CENTER_PROMPT, from: C });
            type(editor, '2000,1500');
            // The centre itself gives no direction, the ray through the start a full circle
            for (const point of ['2000,1500', '2500,1500', '2200,1500']) {
                expect(previewAt(editor, { x: Number(point.slice(0, 4)), y: 1500 })).toBeNull();
                type(editor, point);
                expect(editor.snapshot).toMatchObject({ command: 'ARC', prompt: DIRECTION_PROMPT, from: CENTER });
            }
            expect(arcs()).toEqual([]);
            // Opposite the start is half a circle
            type(editor, '1000,1500');
            expect(arcs()).toEqual([{ center: CENTER, start: C, end: A, clockwise: false }]);
        });

        it('measures the centre and the end from the point before', () => {
            const { editor, arcs } = setup();
            editor.startCommand('ARC', 'startCenterEnd');
            type(editor, '2500,1500');
            type(editor, '@-500,0');
            type(editor, '@100<90');
            expect(arcs()).toEqual([{ center: CENTER, start: C, end: B, clockwise: false }]);
        });

        it('starts anew with another method, keeps running with the same, and Enter repeats BOGEN as such', () => {
            const { editor, arcs } = setup();
            editor.startCommand('ARC');
            type(editor, '1500,1500');
            editor.startCommand('ARC', 'threePoints');
            editor.startCommand('ARC');
            expect(editor.snapshot).toMatchObject({ prompt: SECOND_PROMPT, from: A });
            editor.startCommand('ARC', 'startCenterEnd');
            expect(editor.snapshot).toMatchObject({ command: 'ARC', prompt: START_PROMPT, from: null });
            type(editor, '2500,1500');
            editor.startCommand('ARC', 'startCenterEnd');
            expect(editor.snapshot).toMatchObject({ prompt: CENTER_PROMPT, from: C });
            // The option makes it that method too
            editor.startCommand('ARC', 'threePoints');
            type(editor, '2500,1500');
            type(editor, 'Zentrum');
            editor.startCommand('ARC', 'startCenterEnd');
            expect(editor.snapshot).toMatchObject({ prompt: CENTER_PROMPT, from: C });
            type(editor, '2000,1500');
            type(editor, '2000,2300');
            expect(arcs()).toHaveLength(1);
            editor.keyDown({ key: 'Enter' });
            type(editor, '1500,1500');
            expect(editor.snapshot).toMatchObject({ command: 'ARC', prompt: SECOND_PROMPT });
        });

        it('ends with Esc at the centre and at the end, without an arc', () => {
            const { editor, arcs } = setup();
            for (const points of [['2500,1500'], ['2500,1500', '2000,1500']]) {
                editor.startCommand('ARC', 'startCenterEnd');
                points.forEach((point) => type(editor, point));
                editor.keyDown({ key: 'Escape' });
                expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*' });
            }
            expect(arcs()).toEqual([]);
        });
    });

    describe('start, centre, angle', () => {
        const BELOW = { x: 2000, y: 1000 };
        /** BOGEN at the angle prompt, from C around CENTER. */
        const atAngle = () => {
            const context = setup();
            context.editor.startCommand('ARC', 'startCenterAngle');
            type(context.editor, '2500,1500');
            type(context.editor, '2000,1500');
            return context;
        };

        it('takes the included angle with the option "Winkel": positive counter-clockwise, negative clockwise', () => {
            const { editor, arcs, history } = setup();
            const before = history.document;
            for (const angle of ['90', '-90', '450']) {
                editor.startCommand('ARC');
                type(editor, '2500,1500');
                type(editor, 'Z');
                type(editor, '2000,1500');
                type(editor, 'w');
                expect(editor.snapshot).toMatchObject({ prompt: ANGLE_PROMPT, from: CENTER, preview: { kind: 'curve', rubberBand: true } });
                type(editor, angle);
                expect(editor.snapshot).toMatchObject({ command: null, prompt: 'Befehl:' });
            }
            expect(arcs()).toEqual([
                { center: CENTER, start: C, end: B, clockwise: false },
                { center: CENTER, start: C, end: BELOW, clockwise: true },
                { center: CENTER, start: C, end: B, clockwise: false },
            ]);
            // Quarter turns are exact
            expect(history.document.vertices.at(-1)).toMatchObject(B);
            editor.undo();
            expect(editor.snapshot.message).toBe('Rückgängig: BOGEN');
            editor.undo();
            editor.undo();
            expect(history.document.vertices).toEqual(before.vertices);
        });

        it('asks for the angle straight after the centre when started with the method', () => {
            const { editor, arcs } = setup();
            editor.startCommand('ARC', 'startCenterAngle');
            click(editor, C);
            expect(editor.snapshot).toMatchObject({ prompt: 'Mittelpunkt für Bogen angeben:', from: C });
            click(editor, CENTER);
            expect(editor.snapshot).toMatchObject({ prompt: ANGLE_PROMPT, from: CENTER });
            type(editor, '180');
            expect(arcs()).toEqual([{ center: CENTER, start: C, end: A, clockwise: false }]);
        });

        it('takes the direction from the centre to a point as the angle, from +X and never negative', () => {
            const { editor, arcs } = atAngle();
            expect(previewAt(editor, { x: 2000, y: 1800 })).toEqual({ kind: 'arc', center: CENTER, start: C, end: B, clockwise: false });
            expect(previewAt(editor, { x: 2000, y: 1200 })).toMatchObject({ end: BELOW, clockwise: false });
            // Straight up is 90°
            click(editor, { x: 2000, y: 1800 });
            // Straight down is 270°, not -90°
            editor.startCommand('ARC', 'startCenterAngle');
            type(editor, '2500,1500');
            type(editor, '2000,1500');
            click(editor, { x: 2000, y: 1200 });
            // Not measured from the start: from the top, 90° end on the left
            editor.startCommand('ARC', 'startCenterAngle');
            type(editor, '2000,2000');
            type(editor, '2000,1500');
            type(editor, '@100<90');
            expect(arcs()).toEqual([
                { center: CENTER, start: C, end: B, clockwise: false },
                { center: CENTER, start: C, end: BELOW, clockwise: false },
                { center: CENTER, start: B, end: A, clockwise: false },
            ]);
        });

        it('turns the other way with Ctrl, in the preview and for the arc', () => {
            const { editor, arcs } = atAngle();
            const { prompt } = editor.snapshot;
            editor.keyDown({ key: '9' });
            expect(editor.keyDown({ key: 'Control' })).toBe(true);
            expect(editor.snapshot).toMatchObject({ prompt, input: '9' });
            expect(previewAt(editor, { x: 2000, y: 1800 })).toMatchObject({ end: BELOW, clockwise: true });
            editor.keyDown({ key: '0' });
            editor.keyDown({ key: 'Enter' });
            // A negative angle then runs counter-clockwise
            editor.startCommand('ARC', 'startCenterAngle');
            type(editor, '2500,1500');
            type(editor, '2000,1500');
            editor.keyDown({ key: 'Control' });
            type(editor, '-90');
            // Twice is as before, and the option takes the direction along
            editor.startCommand('ARC', 'startCenterEnd');
            type(editor, '2500,1500');
            type(editor, '2000,1500');
            editor.keyDown({ key: 'Control' });
            type(editor, 'W');
            type(editor, '90');
            expect(arcs()).toEqual([
                { center: CENTER, start: C, end: BELOW, clockwise: true },
                { center: CENTER, start: C, end: B, clockwise: false },
                { center: CENTER, start: C, end: BELOW, clockwise: true },
            ]);
        });

        it('takes no angle that gives no arc, and needs a number or a point', () => {
            const { editor, arcs } = atAngle();
            for (const angle of ['0', '360', '-720']) {
                type(editor, angle);
                expect(editor.snapshot).toMatchObject({ command: 'ARC', prompt: ANGLE_PROMPT, message: ANGLE_INVALID });
            }
            // A point on the +X ray from the centre is 0°
            expect(previewAt(editor, { x: 2300, y: 1500 })).toBeNull();
            type(editor, '2300,1500');
            expect(editor.snapshot).toMatchObject({ prompt: ANGLE_PROMPT, message: ANGLE_INVALID });
            for (const text of ['', 'x']) {
                type(editor, text);
                expect(editor.snapshot).toMatchObject({
                    prompt: ANGLE_PROMPT,
                    message: 'Erfordert gültigen numerischen Winkel oder zweiten Punkt.',
                });
            }
            expect(arcs()).toEqual([]);
            type(editor, '45');
            const [arc] = arcs();
            expect(arc.end).toEqual({ x: round(2000 + 500 * Math.SQRT1_2), y: round(1500 + 500 * Math.SQRT1_2) });
        });

        it('starts anew from another method, keeps running once the option chose it, and ends with Esc', () => {
            const { editor, arcs } = setup();
            editor.startCommand('ARC', 'startCenterEnd');
            type(editor, '2500,1500');
            editor.startCommand('ARC', 'startCenterAngle');
            expect(editor.snapshot).toMatchObject({ prompt: START_PROMPT, from: null });
            editor.startCommand('ARC', 'startCenterEnd');
            type(editor, '2500,1500');
            type(editor, '2000,1500');
            type(editor, 'Winkel');
            editor.startCommand('ARC', 'startCenterAngle');
            expect(editor.snapshot).toMatchObject({ prompt: ANGLE_PROMPT, from: CENTER });
            editor.keyDown({ key: 'Escape' });
            expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*' });
            expect(arcs()).toEqual([]);
        });
    });
});
