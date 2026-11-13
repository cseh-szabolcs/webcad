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

const START_PROMPT = 'Startpunkt für Bogen angeben oder [Zentrum]:';
const START_AFTER_CENTER_PROMPT = 'Startpunkt für Bogen angeben:';
const SECOND_PROMPT = 'Zweiten Punkt für Bogen angeben oder [Zentrum/Endpunkt]:';
const END_PROMPT = 'Endpunkt für Bogen angeben:';
const CENTER_PROMPT = 'Mittelpunkt für Bogen angeben:';
const DIRECTION_PROMPT = 'Endpunkt für Bogen angeben (Strg wechselt die Richtung) oder [Winkel/sehnenLänge]:';
const CHORD_PROMPT = 'Sehnenlänge angeben (Strg wechselt die Richtung):';
const CHORD_INVALID = 'Sehnenlänge darf nicht 0 und nicht länger als der Durchmesser sein.';
const ANGLE_PROMPT = 'Eingeschlossenen Winkel angeben (Strg wechselt die Richtung):';
const ANGLE_INVALID = 'Winkel darf nicht 0 oder ein Vielfaches von 360 sein.';

/** Without Dynamic Input, so typed coordinates are absolute. */
const setup = (dynamicInput = false) => {
    const history = new DocumentHistory(parseDocument(samplePlan));
    const editor = new SelectionEditor(history);
    editor.setDynamicInputSettings({ ...DEFAULT_DYNAMIC_INPUT_SETTINGS, enabled: dynamicInput });
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

    it('knows no other options at its points, and Enter alone gives no point after the start', () => {
        const { editor } = setup();
        editor.startCommand('ARC');
        for (const text of ['W', 'x']) {
            type(editor, text);
            expect(editor.snapshot).toMatchObject({ prompt: START_PROMPT, message: 'Punkt oder Option-Schlüsselwort erforderlich.' });
        }
        type(editor, '1500,1500');
        for (const text of ['', 'W', 'x']) {
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

    describe('start, centre, length', () => {
        const BELOW = { x: 2000, y: 1000 };
        /** BOGEN at the chord prompt, from C around CENTER (radius 500). */
        const atChord = () => {
            const context = setup();
            context.editor.startCommand('ARC', 'startCenterLength');
            type(context.editor, '2500,1500');
            type(context.editor, '2000,1500');
            return context;
        };
        const QUARTER_CHORD = 500 * Math.SQRT2;

        it('takes the length of the chord with the option "sehnenLänge": the minor arc, negative the major one', () => {
            const { editor, arcs } = setup();
            for (const length of ['500', '-500', '1000', '-1000']) {
                editor.startCommand('ARC');
                type(editor, '2500,1500');
                type(editor, 'z');
                type(editor, '2000,1500');
                type(editor, 'L');
                expect(editor.snapshot).toMatchObject({ prompt: CHORD_PROMPT, from: C, preview: { kind: 'curve', rubberBand: true } });
                type(editor, length);
                expect(editor.snapshot).toMatchObject({ command: null, prompt: 'Befehl:' });
            }
            // A chord as long as the radius spans 60°, the major arc 300°; the diameter half the circle either way
            const at60 = { x: 2250, y: round(1500 + 250 * Math.sqrt(3)) };
            const at300 = { x: 2250, y: round(1500 - 250 * Math.sqrt(3)) };
            expect(arcs()).toEqual([
                { center: CENTER, start: C, end: at60, clockwise: false },
                { center: CENTER, start: C, end: at300, clockwise: false },
                { center: CENTER, start: C, end: A, clockwise: false },
                { center: CENTER, start: C, end: A, clockwise: false },
            ]);
        });

        it('asks for the chord straight after the centre when started with the method, and measures it from the start', () => {
            const { editor, arcs } = atChord();
            expect(editor.snapshot).toMatchObject({ prompt: CHORD_PROMPT, from: C });
            // Only the distance of the point counts, not where it lies
            const far = { x: 2500 - QUARTER_CHORD, y: 1500 };
            const preview = previewAt(editor, far);
            expect(preview).toMatchObject({ kind: 'arc', center: CENTER, start: C, clockwise: false });
            expect(round((preview as { end: Point }).end.y)).toBe(2000);
            type(editor, `${far.x},${far.y}`);
            expect(arcs()).toEqual([{ center: CENTER, start: C, end: B, clockwise: false }]);
        });

        it('turns the other way with Ctrl', () => {
            const { editor, arcs } = atChord();
            expect(editor.keyDown({ key: 'Control' })).toBe(true);
            expect(editor.snapshot.prompt).toBe(CHORD_PROMPT);
            type(editor, String(QUARTER_CHORD));
            // The option takes the direction along
            editor.startCommand('ARC', 'startCenterEnd');
            type(editor, '2500,1500');
            type(editor, '2000,1500');
            editor.keyDown({ key: 'Control' });
            type(editor, 'Länge');
            type(editor, String(-QUARTER_CHORD));
            expect(arcs()).toEqual([
                { center: CENTER, start: C, end: BELOW, clockwise: true },
                { center: CENTER, start: C, end: B, clockwise: true },
            ]);
        });

        it('takes no chord of length 0 or beyond the diameter, and needs a number or a point', () => {
            const { editor, arcs } = atChord();
            for (const length of ['0', '1000.5', '-2000']) {
                type(editor, length);
                expect(editor.snapshot).toMatchObject({ command: 'ARC', prompt: CHORD_PROMPT, message: CHORD_INVALID });
            }
            expect(previewAt(editor, C)).toBeNull();
            expect(previewAt(editor, { x: 1000, y: 1500 })).toBeNull();
            type(editor, '1000,1500');
            expect(editor.snapshot).toMatchObject({ prompt: CHORD_PROMPT, message: CHORD_INVALID });
            for (const text of ['', 'x']) {
                type(editor, text);
                expect(editor.snapshot).toMatchObject({ prompt: CHORD_PROMPT, message: 'Erfordert numerischen Abstand oder zweiten Punkt.' });
            }
            expect(arcs()).toEqual([]);
        });
    });

    describe('centre first', () => {
        const BELOW = { x: 2000, y: 1000 };

        it('takes the centre before the start with the option "Zentrum" at the start', () => {
            const { editor, arcs } = setup();
            editor.startCommand('ARC');
            type(editor, 'Zentrum');
            expect(editor.snapshot).toMatchObject({ command: 'ARC', prompt: CENTER_PROMPT, from: null, preview: null });
            type(editor, '2000,1500');
            // Only the rubber band from the centre
            expect(editor.snapshot).toMatchObject({ prompt: START_AFTER_CENTER_PROMPT, from: CENTER, preview: { kind: 'curve', rubberBand: true } });
            expect(previewAt(editor, C)).toBeNull();
            // The centre again has no radius, and there is no option here
            type(editor, '2000,1500');
            type(editor, 'z');
            expect(editor.snapshot).toMatchObject({ prompt: START_AFTER_CENTER_PROMPT, message: 'Punkt oder Option-Schlüsselwort erforderlich.' });
            type(editor, '@500,0');
            expect(editor.snapshot).toMatchObject({ prompt: DIRECTION_PROMPT, from: CENTER });
            expect(previewAt(editor, { x: 2000, y: 2300 })).toEqual({ kind: 'arc', center: CENTER, start: C, end: B, clockwise: false });
            type(editor, '2000,2300');
            expect(arcs()).toEqual([{ center: CENTER, start: C, end: B, clockwise: false }]);
        });

        it('starts at the centre with its methods, which end by a point, an angle or a chord', () => {
            const { editor, arcs } = setup();
            const last = { centerStartEnd: '2000,1200', centerStartAngle: '-90', centerStartLength: '1000' } as const;
            const prompts = { centerStartEnd: DIRECTION_PROMPT, centerStartAngle: ANGLE_PROMPT, centerStartLength: CHORD_PROMPT };
            for (const method of ['centerStartEnd', 'centerStartAngle', 'centerStartLength'] as const) {
                editor.startCommand('ARC', method);
                expect(editor.snapshot).toMatchObject({ command: 'ARC', prompt: CENTER_PROMPT, from: null });
                click(editor, CENTER);
                click(editor, C);
                expect(editor.snapshot.prompt).toBe(prompts[method]);
                type(editor, last[method]);
            }
            expect(arcs()).toEqual([
                { center: CENTER, start: C, end: BELOW, clockwise: false },
                { center: CENTER, start: C, end: BELOW, clockwise: true },
                { center: CENTER, start: C, end: A, clockwise: false },
            ]);
        });

        it('keeps what ends the arc when the option moves the centre first, and the options at the end still work', () => {
            const { editor, arcs } = setup();
            editor.startCommand('ARC', 'startCenterAngle');
            type(editor, 'z');
            type(editor, '2000,1500');
            type(editor, '2500,1500');
            expect(editor.snapshot).toMatchObject({ prompt: ANGLE_PROMPT, from: CENTER });
            // It is that method now
            editor.startCommand('ARC', 'centerStartAngle');
            expect(editor.snapshot.prompt).toBe(ANGLE_PROMPT);
            type(editor, '90');
            editor.startCommand('ARC', 'centerStartEnd');
            type(editor, '2000,1500');
            type(editor, '2500,1500');
            editor.keyDown({ key: 'Control' });
            type(editor, 'L');
            editor.startCommand('ARC', 'centerStartLength');
            expect(editor.snapshot).toMatchObject({ prompt: CHORD_PROMPT, from: C });
            type(editor, '1000');
            expect(arcs()).toEqual([
                { center: CENTER, start: C, end: B, clockwise: false },
                { center: CENTER, start: C, end: A, clockwise: true },
            ]);
        });

        it('starts anew from the other order, and ends with Esc at the centre and at the start', () => {
            const { editor, arcs } = setup();
            editor.startCommand('ARC', 'startCenterEnd');
            type(editor, '2500,1500');
            editor.startCommand('ARC', 'centerStartEnd');
            expect(editor.snapshot).toMatchObject({ prompt: CENTER_PROMPT, from: null });
            editor.keyDown({ key: 'Escape' });
            expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*' });
            editor.startCommand('ARC', 'centerStartEnd');
            type(editor, '2000,1500');
            editor.keyDown({ key: 'Escape' });
            expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*' });
            // Enter repeats BOGEN as such, from the start
            editor.keyDown({ key: 'Enter' });
            expect(editor.snapshot).toMatchObject({ command: 'ARC', prompt: START_PROMPT });
            expect(arcs()).toEqual([]);
        });
    });

    describe('start, end', () => {
        const ABOVE = B;
        const BELOW = { x: 2000, y: 1000 };
        const CENTER_OPTIONS_PROMPT = 'Mittelpunkt für Bogen angeben (Strg wechselt die Richtung) oder [Winkel/RIchtung/RAdius]:';
        const DIRECTION_OF_START_PROMPT = 'Tangentenrichtung für Startpunkt des Bogens angeben (Strg wechselt die Richtung):';
        const RADIUS_PROMPT = 'Radius für Bogen angeben (Strg wechselt die Richtung):';
        const QUARTER_RADIUS = 500 * Math.SQRT2;
        /** BOGEN with that method after the start A and the end C, a chord of 1000. */
        const overChord = (method: 'startEndAngle' | 'startEndDirection' | 'startEndRadius') => {
            const context = setup();
            const again = () => {
                context.editor.startCommand('ARC', method);
                type(context.editor, '1500,1500');
                type(context.editor, '2500,1500');
            };
            again();
            return { ...context, again };
        };

        it('takes the end after the start with the option "Endpunkt", then the centre, which the arc only ends towards the end from', () => {
            const { editor, arcs, history } = setup();
            const before = history.document;
            editor.startCommand('ARC');
            type(editor, '1500,1500');
            type(editor, 'e');
            // Only the rubber band from the start
            expect(editor.snapshot).toMatchObject({ prompt: END_PROMPT, from: A, preview: { kind: 'curve', rubberBand: true } });
            expect(previewAt(editor, C)).toBeNull();
            // The start again is no end, and there is no option here
            type(editor, '1500,1500');
            type(editor, 'z');
            expect(editor.snapshot).toMatchObject({ prompt: END_PROMPT, message: 'Punkt oder Option-Schlüsselwort erforderlich.' });
            type(editor, '2500,1500');
            expect(editor.snapshot).toMatchObject({ prompt: CENTER_OPTIONS_PROMPT, from: C, preview: { kind: 'curve', rubberBand: true } });
            expect(previewAt(editor, CENTER)).toEqual({ kind: 'arc', center: CENTER, start: A, end: C, clockwise: false });
            // Ctrl turns it clockwise
            expect(editor.keyDown({ key: 'Control' })).toBe(true);
            expect(previewAt(editor, CENTER)).toMatchObject({ clockwise: true });
            editor.keyDown({ key: 'Control' });
            // The start as the centre has no radius
            type(editor, '1500,1500');
            expect(editor.snapshot.prompt).toBe(CENTER_OPTIONS_PROMPT);
            expect(history.document).toBe(before);
            // A centre the end is not on the circle of: the arc ends on the ray to the end
            type(editor, '1500,2000');
            expect(arcs()).toEqual([
                { center: { x: 1500, y: 2000 }, start: A, end: { x: round(1500 + 1000 / Math.sqrt(5)), y: round(2000 - 500 / Math.sqrt(5)) }, clockwise: false },
            ]);
            editor.undo();
            expect(editor.snapshot.message).toBe('Rückgängig: BOGEN');
            expect(history.document.vertices).toEqual(before.vertices);
        });

        it('takes the included angle: the ends stay, the centre follows; negative runs clockwise', () => {
            const { editor, arcs, again } = overChord('startEndAngle');
            expect(editor.snapshot).toMatchObject({ prompt: ANGLE_PROMPT, from: A, preview: { kind: 'curve', rubberBand: true } });
            // Pointed from the start, from +X: straight up is 90°
            expect(previewAt(editor, { x: 1500, y: 1800 })).toEqual({ kind: 'arc', center: ABOVE, start: A, end: C, clockwise: false });
            for (const angle of ['180', '-180', '90', '-90', '270']) {
                type(editor, angle);
                again();
            }
            click(editor, { x: 1500, y: 1800 });
            expect(arcs()).toEqual([
                { center: CENTER, start: A, end: C, clockwise: false },
                { center: CENTER, start: A, end: C, clockwise: true },
                { center: ABOVE, start: A, end: C, clockwise: false },
                { center: BELOW, start: A, end: C, clockwise: true },
                { center: BELOW, start: A, end: C, clockwise: false },
                { center: ABOVE, start: A, end: C, clockwise: false },
            ]);
            again();
            for (const angle of ['0', '360']) {
                type(editor, angle);
                expect(editor.snapshot).toMatchObject({ prompt: ANGLE_PROMPT, message: ANGLE_INVALID });
            }
            // Ctrl turns it the other way
            editor.keyDown({ key: 'Control' });
            type(editor, '90');
            expect(arcs().at(-1)).toEqual({ center: BELOW, start: A, end: C, clockwise: true });
        });

        it('takes the direction the arc leaves the start in, typed or towards a point', () => {
            const { editor, arcs, again } = overChord('startEndDirection');
            expect(editor.snapshot).toMatchObject({ prompt: DIRECTION_OF_START_PROMPT, from: A });
            // Leaving upwards, it comes over the top
            expect(previewAt(editor, { x: 1500, y: 1800 })).toEqual({ kind: 'arc', center: CENTER, start: A, end: C, clockwise: true });
            for (const direction of ['90', '-90', '270', '45', '135']) {
                type(editor, direction);
                again();
            }
            click(editor, { x: 1500, y: 1800 });
            expect(arcs()).toEqual([
                { center: CENTER, start: A, end: C, clockwise: true },
                { center: CENTER, start: A, end: C, clockwise: false },
                { center: CENTER, start: A, end: C, clockwise: false },
                // A quarter over the chord, and three quarters when it leaves away from the end
                { center: BELOW, start: A, end: C, clockwise: true },
                { center: ABOVE, start: A, end: C, clockwise: true },
                { center: CENTER, start: A, end: C, clockwise: true },
            ]);
            again();
            // Along the chord there is no arc, either way
            for (const direction of ['0', '180']) {
                type(editor, direction);
                expect(editor.snapshot).toMatchObject({
                    prompt: DIRECTION_OF_START_PROMPT,
                    message: 'Richtung darf nicht auf der Geraden durch Start- und Endpunkt liegen.',
                });
            }
            // Ctrl leaves the other way: the rest of the same circle
            editor.keyDown({ key: 'Control' });
            expect(previewAt(editor, { x: 1800, y: 1800 })).toEqual({ kind: 'arc', center: BELOW, start: A, end: C, clockwise: false });
            type(editor, '45');
            expect(arcs().at(-1)).toEqual({ center: BELOW, start: A, end: C, clockwise: false });
        });

        it('takes the radius, typed or as the distance from the end: the minor arc, negative the major one', () => {
            const { editor, arcs, again } = overChord('startEndRadius');
            expect(editor.snapshot).toMatchObject({ prompt: RADIUS_PROMPT, from: C });
            expect(previewAt(editor, { x: 2500, y: 2000 })).toEqual({ kind: 'arc', center: CENTER, start: A, end: C, clockwise: false });
            for (const radius of ['500', String(QUARTER_RADIUS), String(-QUARTER_RADIUS)]) {
                type(editor, radius);
                again();
            }
            // As far from the end as the chord is long: 60° over the chord
            type(editor, '@1000<90');
            expect(arcs()).toEqual([
                { center: CENTER, start: A, end: C, clockwise: false },
                { center: ABOVE, start: A, end: C, clockwise: false },
                { center: BELOW, start: A, end: C, clockwise: false },
                { center: { x: 2000, y: round(1500 + 500 * Math.sqrt(3)) }, start: A, end: C, clockwise: false },
            ]);
            again();
            for (const radius of ['0', '499', '-499']) {
                type(editor, radius);
                expect(editor.snapshot).toMatchObject({
                    prompt: RADIUS_PROMPT,
                    message: 'Radius darf nicht 0 und nicht kleiner als der halbe Abstand der Endpunkte sein.',
                });
            }
            expect(previewAt(editor, { x: 2500, y: 1800 })).toBeNull();
            editor.keyDown({ key: 'Control' });
            type(editor, String(QUARTER_RADIUS));
            expect(arcs().at(-1)).toEqual({ center: BELOW, start: A, end: C, clockwise: true });
        });

        it('reaches angle, direction and radius by the options of the centre prompt, which keep the direction', () => {
            const { editor, arcs } = setup();
            const options = { W: ANGLE_PROMPT, RI: DIRECTION_OF_START_PROMPT, RA: RADIUS_PROMPT, Winkel: ANGLE_PROMPT, Richtung: DIRECTION_OF_START_PROMPT };
            for (const [option, prompt] of Object.entries(options)) {
                editor.startCommand('ARC');
                type(editor, '1500,1500');
                type(editor, 'Endpunkt');
                type(editor, '2500,1500');
                // `R` alone could be either
                type(editor, 'R');
                expect(editor.snapshot).toMatchObject({ prompt: CENTER_OPTIONS_PROMPT, message: 'Punkt oder Option-Schlüsselwort erforderlich.' });
                type(editor, option);
                expect(editor.snapshot.prompt).toBe(prompt);
                editor.keyDown({ key: 'Escape' });
            }
            editor.startCommand('ARC');
            type(editor, '1500,1500');
            type(editor, 'E');
            type(editor, '2500,1500');
            editor.keyDown({ key: 'Control' });
            type(editor, 'RA');
            // It is that method now
            editor.startCommand('ARC', 'startEndRadius');
            expect(editor.snapshot.prompt).toBe(RADIUS_PROMPT);
            type(editor, '500');
            expect(arcs()).toEqual([{ center: CENTER, start: A, end: C, clockwise: true }]);
        });

        it('starts anew from another method, and ends with Esc at the end and at what defines the arc', () => {
            const { editor, arcs } = setup();
            editor.startCommand('ARC', 'startEndAngle');
            expect(editor.snapshot).toMatchObject({ command: 'ARC', prompt: START_PROMPT });
            click(editor, A);
            expect(editor.snapshot).toMatchObject({ prompt: END_PROMPT, from: A });
            editor.startCommand('ARC', 'startEndRadius');
            expect(editor.snapshot).toMatchObject({ prompt: START_PROMPT, from: null });
            // The centre first makes it centre, start, end
            type(editor, 'Z');
            editor.startCommand('ARC', 'centerStartEnd');
            expect(editor.snapshot.prompt).toBe(CENTER_PROMPT);
            for (const points of [['1500,1500'], ['1500,1500', '2500,1500']]) {
                editor.startCommand('ARC', 'startEndDirection');
                points.forEach((point) => type(editor, point));
                editor.keyDown({ key: 'Escape' });
                expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*' });
            }
            expect(arcs()).toEqual([]);
        });
    });

    describe('continue', () => {
        const TANGENT_PROMPT = 'Endpunkt für Bogen angeben (Strg wechselt die Richtung):';
        const NOTHING_TO_CONTINUE = 'Keine Linie oder kein Bogen zum Fortsetzen.';
        /** A line to A that arrives there heading east. */
        const afterLine = () => {
            const context = setup();
            context.editor.startCommand('LINE');
            type(context.editor, '1000,1500');
            type(context.editor, '1500,1500');
            context.editor.keyDown({ key: 'Enter' });
            return context;
        };

        it('goes on from the line drawn last with Enter at the start, leaving its end in its direction', () => {
            const { editor, arcs, history } = afterLine();
            const before = history.document;
            editor.startCommand('ARC');
            editor.keyDown({ key: 'Enter' });
            expect(editor.snapshot).toMatchObject({ command: 'ARC', prompt: TANGENT_PROMPT, from: A, preview: { kind: 'curve', rubberBand: true } });
            expect(previewAt(editor, B)).toEqual({ kind: 'arc', center: { x: 1500, y: 2000 }, start: A, end: B, clockwise: false });
            // Straight on or straight back there is no arc
            for (const point of ['2000,1500', '1000,1500', '1500,1500']) {
                type(editor, point);
                expect(editor.snapshot).toMatchObject({ command: 'ARC', prompt: TANGENT_PROMPT, from: A });
            }
            expect(history.document).toBe(before);
            type(editor, '2000,2000');
            expect(arcs()).toEqual([{ center: { x: 1500, y: 2000 }, start: A, end: B, clockwise: false }]);
            editor.undo();
            expect(editor.snapshot.message).toBe('Rückgängig: BOGEN');
        });

        it('goes on from its own arc, so Enter twice at "Befehl:" chains tangent arcs', () => {
            const { editor, arcs } = afterLine();
            editor.startCommand('ARC', 'continue');
            expect(editor.snapshot).toMatchObject({ prompt: TANGENT_PROMPT, from: A });
            type(editor, '2000,2000');
            // The arc arrives heading north: on to the upper right it turns clockwise
            editor.keyDown({ key: 'Enter' });
            editor.keyDown({ key: 'Enter' });
            expect(editor.snapshot).toMatchObject({ command: 'ARC', prompt: TANGENT_PROMPT, from: B });
            type(editor, '2500,2500');
            expect(arcs()).toEqual([
                { center: { x: 1500, y: 2000 }, start: A, end: B, clockwise: false },
                { center: { x: 2500, y: 2000 }, start: B, end: { x: 2500, y: 2500 }, clockwise: true },
            ]);
        });

        it('goes on from an arc whose end vertex lies off it, and from a polyline', () => {
            const { editor, arcs } = setup();
            // Start, centre, end towards a far point: the arc ends on its circle
            editor.startCommand('ARC', 'startCenterEnd');
            for (const point of ['2500,1500', '2000,1500', '2000,2300']) {
                type(editor, point);
            }
            editor.startCommand('ARC', 'continue');
            // Arriving at B heading west
            expect(editor.snapshot).toMatchObject({ prompt: TANGENT_PROMPT, from: B });
            expect(previewAt(editor, { x: 1500, y: 2500 })).toMatchObject({ center: { x: 2000, y: 2500 }, clockwise: true });
            editor.keyDown({ key: 'Escape' });
            editor.startCommand('PLINE');
            for (const point of ['1000,1000', '1500,1000', '1500,1500']) {
                type(editor, point);
            }
            editor.keyDown({ key: 'Enter' });
            // The last segment arrives at A heading north
            editor.startCommand('ARC', 'continue');
            expect(editor.snapshot).toMatchObject({ prompt: TANGENT_PROMPT, from: A });
            type(editor, '2000,2000');
            expect(arcs().at(-1)).toEqual({ center: { x: 2000, y: 1500 }, start: A, end: B, clockwise: true });
        });

        it('leaves the other way with Ctrl: the rest of the same circle', () => {
            const { editor, arcs } = afterLine();
            editor.startCommand('ARC', 'continue');
            expect(editor.keyDown({ key: 'Control' })).toBe(true);
            expect(previewAt(editor, B)).toEqual({ kind: 'arc', center: { x: 1500, y: 2000 }, start: A, end: B, clockwise: true });
            type(editor, '2000,2000');
            expect(arcs()).toEqual([{ center: { x: 1500, y: 2000 }, start: A, end: B, clockwise: true }]);
        });

        it('reports when there is nothing to continue, and asks for the start as usual', () => {
            const { editor, arcs } = setup();
            editor.startCommand('ARC');
            editor.keyDown({ key: 'Enter' });
            expect(editor.snapshot).toMatchObject({ command: 'ARC', prompt: START_PROMPT, message: NOTHING_TO_CONTINUE });
            editor.keyDown({ key: 'Escape' });
            editor.startCommand('ARC', 'continue');
            expect(editor.snapshot).toMatchObject({ command: 'ARC', prompt: START_PROMPT, message: NOTHING_TO_CONTINUE });
            for (const point of ['1500,1500', '2000,2000', '2500,1500']) {
                type(editor, point);
            }
            expect(arcs()).toHaveLength(1);
            // Not once the arc is undone, nor from a circle
            editor.undo();
            editor.startCommand('ARC', 'continue');
            expect(editor.snapshot).toMatchObject({ prompt: START_PROMPT, message: NOTHING_TO_CONTINUE });
        });

        it('starts anew from another method, and Enter means nothing once the start is given', () => {
            const { editor } = afterLine();
            editor.startCommand('ARC', 'continue');
            editor.startCommand('ARC', 'continue');
            expect(editor.snapshot.prompt).toBe(TANGENT_PROMPT);
            editor.keyDown({ key: 'Enter' });
            expect(editor.snapshot).toMatchObject({ prompt: TANGENT_PROMPT, message: 'Punkt oder Option-Schlüsselwort erforderlich.' });
            editor.startCommand('ARC', 'threePoints');
            expect(editor.snapshot).toMatchObject({ prompt: START_PROMPT, from: null });
            // Enter at the start of any method continues
            editor.startCommand('ARC', 'startCenterAngle');
            editor.keyDown({ key: 'Enter' });
            expect(editor.snapshot).toMatchObject({ prompt: TANGENT_PROMPT, from: A });
        });
    });

    describe('with Dynamic Input', () => {
        const BELOW = { x: 2000, y: 1000 };
        /** BOGEN with that method after clicks at C and CENTER, the pointer straight above the centre. */
        const afterTwoClicks = (method: 'startCenterAngle' | 'startCenterLength') => {
            const context = setup(true);
            context.editor.startCommand('ARC', method);
            click(context.editor, C);
            click(context.editor, CENTER);
            context.editor.pointerMove(at({ x: 2000, y: 1800 }));
            return context;
        };
        const keys = (editor: SelectionEditor, text: string) => [...text].forEach((key) => editor.keyDown({ key }));
        /** What the overlay draws: for a typed number what the tool gives for it, else for the point. */
        const shown = (editor: SelectionEditor) => {
            const { preview, previewPoint, previewValue } = editor.snapshot;
            if (typeof preview !== 'object' || preview?.kind !== 'curve' || previewPoint === null) {
                throw new Error('no curve preview');
            }
            return previewValue !== null && preview.curveFor ? preview.curveFor(previewValue) : preview.curveAt(previewPoint);
        };

        it('shows the angle field alone, with the live direction from the centre', () => {
            const { editor } = afterTwoClicks('startCenterAngle');
            expect(editor.snapshot).toMatchObject({ previewValue: null, from: CENTER });
            expect(editor.snapshot.dynamicInput).toMatchObject({
                layout: 'dimension',
                format: 'angle',
                relative: true,
                fields: [{ kind: 'angle', text: '90', typed: false, focused: true }],
                bound: false,
            });
            expect(shown(editor)).toMatchObject({ end: B, clockwise: false });
        });

        it('previews and takes a typed angle with its sign, by Enter or by a click', () => {
            for (const give of ['Enter', 'click'] as const) {
                const { editor, arcs } = afterTwoClicks('startCenterAngle');
                keys(editor, '-90');
                expect(editor.snapshot).toMatchObject({ input: '-90', previewValue: -90 });
                expect(editor.snapshot.dynamicInput).toMatchObject({ fields: [{ kind: 'angle', text: '-90', typed: true }], bound: true });
                // The bound point lies straight below the centre, which alone would mean 270° counter-clockwise
                expect(editor.snapshot.previewPoint?.y).toBeCloseTo(1200);
                expect(shown(editor)).toMatchObject({ end: BELOW, clockwise: true });
                if (give === 'Enter') {
                    editor.keyDown({ key: 'Enter' });
                } else {
                    click(editor, { x: 2600, y: 1900 });
                }
                expect(arcs()).toEqual([{ center: CENTER, start: C, end: BELOW, clockwise: true }]);
            }
        });

        it('previews and takes a typed chord length with its sign too', () => {
            const { editor, arcs } = afterTwoClicks('startCenterLength');
            expect(editor.snapshot.dynamicInput).toMatchObject({ format: 'distance', fields: [{ kind: 'distance' }] });
            keys(editor, '-500');
            expect(editor.snapshot.previewValue).toBe(-500);
            // The major arc: 300° round to below the start
            const at300 = { x: 2250, y: round(1500 - 250 * Math.sqrt(3)) };
            const preview = shown(editor);
            expect(preview).toMatchObject({ kind: 'arc', clockwise: false });
            expect(round((preview as { end: Point }).end.y)).toBe(at300.y);
            click(editor, { x: 2600, y: 1900 });
            expect(arcs()).toEqual([{ center: CENTER, start: C, end: at300, clockwise: false }]);
        });

        it('takes other text in the field as typed on the command line, and Esc drops it first', () => {
            const { editor, arcs } = afterTwoClicks('startCenterAngle');
            keys(editor, '9');
            editor.keyDown({ key: 'Escape' });
            expect(editor.snapshot).toMatchObject({ command: 'ARC', input: '', previewValue: null });
            keys(editor, 'x');
            expect(editor.snapshot.previewValue).toBeNull();
            editor.keyDown({ key: 'Enter' });
            expect(editor.snapshot.message).toBe('Erfordert gültigen numerischen Winkel oder zweiten Punkt.');
            // A point: its direction from the centre
            keys(editor, '@100<180');
            editor.keyDown({ key: 'Enter' });
            expect(arcs()).toEqual([{ center: CENTER, start: C, end: A, clockwise: false }]);
        });
    });
});
