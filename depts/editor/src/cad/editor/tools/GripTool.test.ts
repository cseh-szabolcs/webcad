import { describe, expect, it } from 'vitest';
import type { CircleElement } from '../../model/CadElement';
import type { Point } from '../../model/Point';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import type { EditorPointerEvent } from '../EditorPointerEvent';
import { DocumentHistory } from '../commands/DocumentHistory';
import { SelectionEditor } from '../SelectionEditor';
import { DEFAULT_DYNAMIC_INPUT_SETTINGS, DEFAULT_SNAP_SETTINGS } from '../../../settings/editorSettings';
import type { CadElement } from '../../model/CadElement';

const { element: E, vertex: V } = sampleIds;

/** One screen pixel is 2 mm (Y flipped): the pick box reaches 10 mm, a grip 7 mm more. */
const at = (modelPoint: Point, change: Partial<EditorPointerEvent> = {}): EditorPointerEvent => ({
    viewPoint: { x: modelPoint.x / 2, y: -modelPoint.y / 2 },
    modelPoint,
    pixelSize: 2,
    button: 0,
    shiftKey: false,
    altKey: false,
    ...change,
});
/** The table's right quadrant, on its outline, so a click there also selects it. */
const QUADRANT = { x: 4600, y: 1800 };
const CENTRE = { x: 4000, y: 1800 };
/** Empty space right of the table and its rug, where nothing snaps. */
const TARGET = { x: 5300, y: 1800 };
const WINDOW = { x: 4250, y: 3880 };
const WINDOW_END = { x: 5000, y: 3880 };

const OPTIONS = '[BAsispunkt/Kopieren/Zurück/eXit]:';
const MEASURED_OPTIONS = '[BAsispunkt/Kopieren/Zurück/BEzug/eXit]:';
const STRETCH_PROMPT = `** STRECKEN ** Streckpunkt angeben oder ${OPTIONS}`;

const setup = (dynamicInput = false) => {
    const history = new DocumentHistory(parseDocument(samplePlan));
    const editor = new SelectionEditor(history);
    editor.setDynamicInputSettings({ ...DEFAULT_DYNAMIC_INPUT_SETTINGS, enabled: dynamicInput });
    const radius = () => (history.document.elements.find((e) => e.id === E.table) as CircleElement).radius;
    const vertex = (id: string) => {
        const { x, y } = history.document.vertices.find((v) => v.id === id)!;
        return { x, y };
    };
    return { editor, history, radius, vertex };
};
/** Moves there, then presses and releases. */
const click = (editor: SelectionEditor, point: Point, change: Partial<EditorPointerEvent> = {}) => {
    editor.pointerMove(at(point, change));
    editor.pointerDown(at(point, change));
    editor.pointerUp(at(point, change));
};
const type = (editor: SelectionEditor, text: string) => {
    for (const key of text) {
        editor.keyDown({ key });
    }
    editor.keyDown({ key: 'Enter' });
};
/** The table selected and its right quadrant grip hot. */
const hotQuadrant = (dynamicInput = false) => {
    const context = setup(dynamicInput);
    click(context.editor, QUADRANT);
    click(context.editor, QUADRANT);
    return context;
};

describe('grips: hover', () => {
    it('shows the grip under the cursor instead of the element below it', () => {
        const { editor } = setup();
        click(editor, QUADRANT);
        expect(editor.snapshot.hoveredGrip?.point).toEqual(QUADRANT);
        // The rug runs through the pick box at its own quadrant, but the grip wins
        editor.pointerMove(at({ x: 4000, y: 2408 }));
        expect(editor.snapshot.hoveredGrip?.point).toEqual({ x: 4000, y: 2400 });
        expect(editor.snapshot.hovered.size).toBe(0);
    });

    it('reaches as far as the pick box touches the grip', () => {
        const { editor } = setup();
        click(editor, QUADRANT);
        editor.pointerMove(at({ x: 4017, y: 1817 }));
        expect(editor.snapshot.hoveredGrip?.point).toEqual(CENTRE);
        editor.pointerMove(at({ x: 4018, y: 1800 }));
        expect(editor.snapshot.hoveredGrip).toBeNull();
    });

    it('has no grip to hover without a selection, while a command runs or a rectangle is open', () => {
        const { editor } = setup();
        editor.pointerMove(at(QUADRANT));
        expect(editor.snapshot.hoveredGrip).toBeNull();
        click(editor, QUADRANT);
        editor.startCommand('MOVE');
        editor.pointerMove(at(QUADRANT));
        expect(editor.snapshot.hoveredGrip).toBeNull();
        editor.keyDown({ key: 'Escape' });
        click(editor, QUADRANT);
        editor.pointerDown(at({ x: 3000, y: 2000 }));
        editor.pointerMove(at(CENTRE));
        expect(editor.snapshot.area).not.toBeNull();
        expect(editor.snapshot.hoveredGrip).toBeNull();
    });
});

describe('grips: stretching', () => {
    it('makes the clicked grip hot and asks for the stretch point', () => {
        const { editor } = hotQuadrant();
        expect(editor.snapshot).toMatchObject({
            command: 'GRIP_EDIT',
            prompt: STRETCH_PROMPT,
            cursor: 'point',
            from: QUADRANT,
            hoveredGrip: null,
        });
        expect(editor.snapshot.hotGrips.map((grip) => grip.point)).toEqual([QUADRANT]);
        expect(editor.snapshot.grips).toHaveLength(5);
        expect([...editor.snapshot.highlighted]).toEqual([E.table]);
    });

    it('previews the element as the point under the cursor would leave it', () => {
        const { editor } = hotQuadrant();
        editor.pointerMove(at(TARGET));
        const { preview, previewPoint } = editor.snapshot;
        expect(previewPoint).toEqual(TARGET);
        if (typeof preview !== 'object' || preview?.kind !== 'elements') {
            throw new Error('no element preview');
        }
        expect([...preview.ids]).toEqual([E.table]);
        const [table] = preview.elementsAt(TARGET);
        expect(table.id).toBe(E.table);
        // The circle's path starts at its right quadrant
        expect(table.path.segments[0].point).toEqual(TARGET);
        // Nothing where the grip cannot go
        expect(preview.elementsAt(CENTRE)).toEqual([]);
    });

    it('stretches to the next click as one undo step and keeps the selection with its grips', () => {
        const { editor, history, radius } = hotQuadrant();
        click(editor, TARGET);
        expect(radius()).toBe(1300);
        expect(editor.snapshot).toMatchObject({ command: null, prompt: 'Befehl:', canUndo: true });
        expect(history.undoCommand?.label).toBe('GRIP_STRETCH');
        expect([...editor.snapshot.highlighted]).toEqual([E.table]);
        expect(editor.snapshot.grips.map((grip) => grip.point)).toContainEqual(TARGET);
        // The cursor rests on the grip it placed
        expect(editor.snapshot.hoveredGrip?.point).toEqual(TARGET);
        expect(editor.snapshot.hotGrips).toEqual([]);
    });

    it('stretches on the release after dragging the grip', () => {
        const { editor, radius } = setup();
        click(editor, QUADRANT);
        editor.pointerDown(at(QUADRANT));
        editor.pointerMove(at(TARGET));
        expect(editor.snapshot.command).toBe('GRIP_EDIT');
        editor.pointerUp(at(TARGET));
        expect(radius()).toBe(1300);
        expect(editor.snapshot.command).toBeNull();
    });

    it('stays at the prompt when the grip is released where it was pressed', () => {
        const { editor, radius } = setup();
        click(editor, QUADRANT);
        editor.pointerDown(at(QUADRANT));
        editor.pointerUp(at({ x: 4604, y: 1800 }));
        expect(editor.snapshot.command).toBe('GRIP_EDIT');
        // A later release is not the end of a drag
        editor.pointerMove(at(TARGET));
        editor.pointerUp(at(TARGET));
        expect(editor.snapshot.command).toBe('GRIP_EDIT');
        expect(radius()).toBe(600);
    });

    it('takes the snap point as the stretch point', () => {
        const { editor, vertex } = setup();
        click(editor, WINDOW);
        click(editor, WINDOW_END);
        // The curtain ends below the window
        editor.pointerMove(at({ x: 5004, y: 3704 }));
        expect(editor.snapshot.snap).toMatchObject({ mode: 'END', point: { x: 5000, y: 3700 } });
        click(editor, { x: 5004, y: 3704 });
        expect(vertex(V['win-2'])).toEqual({ x: 5000, y: 3700 });
        expect(vertex(V['win-1'])).toEqual({ x: 3500, y: 3880 });
    });

    it('takes typed coordinates relative to the grip', () => {
        const { editor, radius } = hotQuadrant();
        type(editor, '@200,0');
        expect(radius()).toBe(800);
    });

    it('goes a typed distance from the grip towards the cursor', () => {
        const { editor, vertex } = setup();
        click(editor, WINDOW);
        click(editor, WINDOW_END);
        editor.pointerMove(at({ x: 5600, y: 3880 }));
        type(editor, '250');
        expect(vertex(V['win-2'])).toEqual({ x: 5250, y: 3880 });
    });

    it('cancels with Escape and keeps the selection; a second Escape clears it', () => {
        const { editor, radius } = hotQuadrant();
        editor.pointerMove(at(TARGET));
        expect(editor.keyDown({ key: 'Escape' })).toBe(true);
        expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*', canUndo: false });
        expect(radius()).toBe(600);
        expect([...editor.snapshot.highlighted]).toEqual([E.table]);
        expect(editor.snapshot.grips).toHaveLength(5);
        expect(editor.keyDown({ key: 'Escape' })).toBe(true);
        expect(editor.snapshot.highlighted.size).toBe(0);
    });

    it('leaves no undo step where the grip does not move or cannot go', () => {
        const still = hotQuadrant();
        click(still.editor, QUADRANT);
        expect(still.editor.snapshot).toMatchObject({ command: null, canUndo: false });
        const collapsed = hotQuadrant();
        // Snaps to the centre of the table: a radius of zero
        click(collapsed.editor, CENTRE);
        expect(collapsed.editor.snapshot).toMatchObject({ command: null, canUndo: false });
        expect(collapsed.radius()).toBe(600);
    });

    it('rejects text that is no point', () => {
        const { editor } = hotQuadrant();
        type(editor, 'q');
        expect(editor.snapshot).toMatchObject({
            command: 'GRIP_EDIT',
            prompt: STRETCH_PROMPT,
            message: 'Punkt oder Option-Schlüsselwort erforderlich.',
        });
    });

    it('is no command that Enter would repeat', () => {
        const { editor } = hotQuadrant();
        click(editor, TARGET);
        expect(editor.keyDown({ key: 'Enter' })).toBe(false);
        expect(editor.snapshot.command).toBeNull();
    });

    it('undoes and redoes with the name of the grip mode', () => {
        const { editor, radius } = hotQuadrant();
        click(editor, TARGET);
        expect(editor.undo()).toBe(true);
        expect(editor.snapshot.message).toBe('Rückgängig: STRECKEN');
        expect(radius()).toBe(600);
        expect(editor.redo()).toBe(true);
        expect(editor.snapshot.message).toBe('Wiederherstellen: STRECKEN');
        expect(radius()).toBe(1300);
    });

    it('still removes the element with Shift+click on its grip', () => {
        const { editor } = setup();
        click(editor, QUADRANT);
        click(editor, QUADRANT, { shiftKey: true });
        expect(editor.snapshot.command).toBeNull();
        expect(editor.snapshot.highlighted.size).toBe(0);
    });

    it('hands the selection to a command started meanwhile', () => {
        const { editor } = hotQuadrant();
        editor.startCommand('MOVE');
        expect(editor.snapshot).toMatchObject({ command: 'MOVE', hotGrips: [], grips: [] });
        expect([...editor.snapshot.highlighted]).toEqual([E.table]);
    });

    it('shows the distance and angle from the grip with Dynamic Input', () => {
        const { editor } = hotQuadrant(true);
        editor.pointerMove(at(TARGET));
        expect(editor.snapshot.dynamicInput).toMatchObject({ layout: 'dimension', relative: true });
        expect(editor.snapshot.dynamicInput?.fields.map((field) => field.text)).toEqual(['700.00', '0']);
    });
});

const MOVE_PROMPT = `** SCHIEBEN ** Verschiebepunkt angeben oder ${OPTIONS}`;
const ROTATE_PROMPT = `** DREHEN ** Drehwinkel angeben oder ${MEASURED_OPTIONS}`;
const SCALE_PROMPT = `** SKALIEREN ** Skalierfaktor angeben oder ${MEASURED_OPTIONS}`;
const MIRROR_PROMPT = `** SPIEGELN ** Zweiten Punkt angeben oder ${OPTIONS}`;
/** Enter as often as it takes from STRETCH to the mode. */
const enter = (editor: SelectionEditor, times: number) => {
    for (let i = 0; i < times; i++) {
        editor.keyDown({ key: 'Enter' });
    }
};
/** Table and rug (which share their centre) selected, the table's right quadrant hot. */
const hotOfTwo = () => {
    const context = setup();
    click(context.editor, QUADRANT);
    click(context.editor, { x: 5000, y: 1800 });
    click(context.editor, QUADRANT);
    const element = (id: string) => context.history.document.elements.find((e) => e.id === id) as CadElement;
    return { ...context, element };
};
/** The window line selected, its right end hot. */
const hotWindowEnd = (dynamicInput = false) => {
    const context = setup(dynamicInput);
    click(context.editor, WINDOW);
    click(context.editor, WINDOW_END);
    return context;
};

describe('grips: modes', () => {

    it('goes through the modes with Enter, Space and a right click, and round again', () => {
        const { editor } = hotQuadrant();
        expect(editor.keyDown({ key: 'Enter' })).toBe(true);
        expect(editor.snapshot).toMatchObject({ command: 'GRIP_EDIT', prompt: MOVE_PROMPT, preview: 'move' });
        expect(editor.keyDown({ key: ' ' })).toBe(true);
        expect(editor.snapshot.prompt).toBe(ROTATE_PROMPT);
        editor.pointerDown(at(TARGET, { button: 2 }));
        expect(editor.snapshot.prompt).toBe(SCALE_PROMPT);
        enter(editor, 1);
        expect(editor.snapshot.prompt).toBe(MIRROR_PROMPT);
        enter(editor, 1);
        expect(editor.snapshot.prompt).toBe(STRETCH_PROMPT);
        // The grip stays hot and the base point of every mode
        expect(editor.snapshot.hotGrips.map((grip) => grip.point)).toEqual([QUADRANT]);
        expect(editor.snapshot.from).toEqual(QUADRANT);
    });

    it('leaves Space to the view at the prompts of other commands', () => {
        const { editor } = setup();
        click(editor, QUADRANT);
        editor.startCommand('MOVE');
        expect(editor.keyDown({ key: ' ' })).toBe(false);
    });

    it('moves the whole selection by the next point', () => {
        const { editor, history, vertex, element } = hotOfTwo();
        enter(editor, 1);
        click(editor, TARGET);
        expect(vertex(V['t-center'])).toEqual({ x: 4700, y: 1800 });
        expect(element(E.table)).toMatchObject({ radius: 600 });
        expect(history.undoCommand?.label).toBe('MOVE');
        expect([...editor.snapshot.highlighted]).toEqual([E.table, E.rug]);
        expect(editor.snapshot.command).toBeNull();
    });

    it('rotates the selection about the grip by a typed angle', () => {
        const { editor, history, vertex } = hotWindowEnd();
        enter(editor, 2);
        type(editor, '90');
        expect(vertex(V['win-2'])).toEqual(WINDOW_END);
        expect(vertex(V['win-1'])).toEqual({ x: 5000, y: 2380 });
        expect(history.undoCommand?.label).toBe('GRIP_ROTATE');
    });

    it('rotates by the direction to a point given, and previews it', () => {
        const { editor, vertex } = hotWindowEnd();
        enter(editor, 2);
        // Straight down from the grip: 270°
        const below = { x: 5000, y: 3000 };
        editor.pointerMove(at(below));
        const { preview, previewPoint } = editor.snapshot;
        if (typeof preview !== 'object' || preview?.kind !== 'transform') {
            throw new Error('no transform preview');
        }
        expect(preview.matrixAt(previewPoint!)).toEqual([0, -1, 1, 0, 5000 - 3880, 3880 + 5000]);
        expect(preview.matrixAt(WINDOW_END)).toBeNull();
        click(editor, below);
        expect(vertex(V['win-1'])).toEqual({ x: 5000, y: 5380 });
    });

    it('takes typed digits as the angle with Dynamic Input on, which shows no field for it', () => {
        const { editor, vertex } = hotWindowEnd(true);
        enter(editor, 2);
        editor.pointerMove(at({ x: 5000, y: 3000 }));
        expect(editor.snapshot.dynamicInput).toBeNull();
        editor.keyDown({ key: '1' });
        expect(editor.snapshot.input).toBe('1');
        type(editor, '80');
        expect(vertex(V['win-1'])).toEqual({ x: 6500, y: 3880 });
    });

    it('asks again for text that is no angle, and leaves no undo step for a full turn', () => {
        const { editor } = hotWindowEnd();
        enter(editor, 2);
        type(editor, 'q');
        expect(editor.snapshot).toMatchObject({
            prompt: ROTATE_PROMPT,
            message: 'Erfordert gültigen numerischen Winkel oder zweiten Punkt.',
        });
        type(editor, '360');
        expect(editor.snapshot).toMatchObject({ command: null, canUndo: false });
    });

    it('scales the selection from the grip by a typed factor', () => {
        const { editor, history, vertex, element } = hotOfTwo();
        enter(editor, 3);
        type(editor, '0.5');
        expect(vertex(V['t-center'])).toEqual({ x: 4300, y: 1800 });
        expect(element(E.table)).toMatchObject({ radius: 300 });
        expect(element(E.rug)).toMatchObject({ radiusX: 500, radiusY: 350 });
        expect(history.undoCommand?.label).toBe('GRIP_SCALE');
    });

    it('takes the distance to a point given as the factor, like AutoCAD', () => {
        const { editor, radius } = hotQuadrant();
        // Two units from the grip, where its own quadrant would snap
        editor.setSnapSettings({ ...DEFAULT_SNAP_SETTINGS, enabled: false });
        enter(editor, 3);
        editor.pointerMove(at({ x: 4602, y: 1800 }));
        const { preview, previewPoint } = editor.snapshot;
        if (typeof preview !== 'object' || preview?.kind !== 'transform') {
            throw new Error('no transform preview');
        }
        expect(preview.matrixAt(previewPoint!)).toEqual([2, 0, 0, 2, -4600, -1800]);
        click(editor, { x: 4602, y: 1800 });
        expect(radius()).toBe(1200);
    });

    it('wants a positive factor, and leaves no undo step for one', () => {
        const { editor, radius } = hotQuadrant();
        enter(editor, 3);
        type(editor, '0');
        expect(editor.snapshot).toMatchObject({ prompt: SCALE_PROMPT, message: 'Wert muss positiv und ungleich Null sein.' });
        type(editor, '-2');
        expect(editor.snapshot.prompt).toBe(SCALE_PROMPT);
        type(editor, '1');
        expect(editor.snapshot).toMatchObject({ command: null, canUndo: false });
        expect(radius()).toBe(600);
    });

    it('mirrors the selection across the line from the grip to the point, without keeping the original', () => {
        const { editor, history, vertex } = hotWindowEnd();
        enter(editor, 4);
        click(editor, { x: 5000, y: 3000 });
        expect(vertex(V['win-1'])).toEqual({ x: 6500, y: 3880 });
        expect(vertex(V['win-2'])).toEqual(WINDOW_END);
        expect(history.document.elements).toHaveLength(10);
        expect(history.undoCommand?.label).toBe('GRIP_MIRROR');
    });

    it('undoes with the name of the mode', () => {
        const { editor } = hotWindowEnd();
        enter(editor, 2);
        type(editor, '90');
        editor.undo();
        expect(editor.snapshot.message).toBe('Rückgängig: DREHEN');
    });

    it('cancels in any mode with Escape and keeps the selection', () => {
        const { editor } = hotQuadrant();
        enter(editor, 3);
        editor.keyDown({ key: 'Escape' });
        expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*', canUndo: false });
        expect([...editor.snapshot.highlighted]).toEqual([E.table]);
    });
});

describe('grips: options', () => {
    const count = (history: DocumentHistory) => history.document.elements.length;
    const circles = (history: DocumentHistory) =>
        history.document.elements.flatMap((e) => (e.type === 'circle' ? [e.radius] : []));

    it('takes another base point than the grip, which stays hot', () => {
        const { editor, radius } = hotQuadrant();
        type(editor, 'ba');
        expect(editor.snapshot).toMatchObject({ prompt: '** STRECKEN ** Basispunkt angeben:', from: null, preview: null });
        click(editor, TARGET);
        expect(editor.snapshot).toMatchObject({ prompt: STRETCH_PROMPT, from: TARGET });
        expect(editor.snapshot.hotGrips.map((grip) => grip.point)).toEqual([QUADRANT]);
        // 100 to the right of the base point: the grip goes as far
        click(editor, { x: 5400, y: 1800 });
        expect(radius()).toBe(700);
    });

    it('wants both capitals of an option that shares its first letter', () => {
        const { editor } = hotQuadrant();
        type(editor, 'b');
        expect(editor.snapshot).toMatchObject({
            prompt: STRETCH_PROMPT,
            message: 'Punkt oder Option-Schlüsselwort erforderlich.',
        });
        type(editor, 'Basispunkt');
        expect(editor.snapshot.prompt).toBe('** STRECKEN ** Basispunkt angeben:');
    });

    it('adds a copy per point with the option Kopieren and leaves the original', () => {
        const { editor, history, radius } = hotQuadrant();
        type(editor, 'k');
        const multiple = `** STRECKEN (mehrere) ** Streckpunkt angeben oder ${OPTIONS}`;
        expect(editor.snapshot.prompt).toBe(multiple);
        editor.pointerMove(at(TARGET));
        expect(editor.snapshot.previewKeeps).toBe(true);
        click(editor, TARGET);
        expect(editor.snapshot).toMatchObject({ command: 'GRIP_EDIT', prompt: multiple });
        click(editor, { x: 5600, y: 1800 });
        expect(circles(history)).toEqual([600, 1300, 1600]);
        expect(radius()).toBe(600);
        expect(editor.snapshot.hotGrips.map((grip) => grip.point)).toEqual([QUADRANT]);
        // Enter ends instead of changing the mode; the copies are one undo step
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot).toMatchObject({ command: null, canUndo: true });
        expect([...editor.snapshot.highlighted]).toEqual([E.table]);
        editor.undo();
        expect(editor.snapshot.message).toBe('Rückgängig: STRECKEN');
        expect(count(history)).toBe(10);
        expect(editor.snapshot.canUndo).toBe(false);
    });

    it('takes back the last copy with Zurück, then has nothing left', () => {
        const { editor, history } = hotQuadrant();
        type(editor, 'k');
        click(editor, TARGET);
        click(editor, { x: 5600, y: 1800 });
        type(editor, 'z');
        expect(circles(history)).toEqual([600, 1300]);
        type(editor, 'Zurück');
        expect(count(history)).toBe(10);
        type(editor, 'z');
        expect(editor.snapshot).toMatchObject({ command: 'GRIP_EDIT', message: 'Nichts zum Zurücknehmen.' });
        editor.keyDown({ key: 'Escape' });
        expect(editor.snapshot.canUndo).toBe(false);
    });

    it('takes back another base point with Zurück', () => {
        const { editor } = hotQuadrant();
        type(editor, 'ba');
        click(editor, TARGET);
        type(editor, 'z');
        expect(editor.snapshot).toMatchObject({ prompt: STRETCH_PROMPT, from: QUADRANT });
    });

    it('keeps the copies made as one undo step after Escape', () => {
        const { editor, history } = hotQuadrant();
        type(editor, 'k');
        click(editor, TARGET);
        click(editor, { x: 5600, y: 1800 });
        editor.keyDown({ key: 'Escape' });
        expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*' });
        expect(count(history)).toBe(12);
        editor.undo();
        expect(count(history)).toBe(10);
    });

    it('copies the whole selection in the other modes', () => {
        const { editor, history, vertex, element } = hotOfTwo();
        enter(editor, 1);
        type(editor, 'k');
        expect(editor.snapshot.prompt).toBe(`** SCHIEBEN (mehrere) ** Verschiebepunkt angeben oder ${OPTIONS}`);
        click(editor, TARGET);
        expect(count(history)).toBe(12);
        expect(vertex(V['t-center'])).toEqual({ x: 4000, y: 1800 });
        const [table, rug] = history.document.elements.slice(-2);
        expect(table).toMatchObject({ type: 'circle', radius: 600 });
        expect(rug).toMatchObject({ type: 'ellipse', centerVertexId: (table as { centerVertexId: string }).centerVertexId });
        expect(element(E.rug)).toMatchObject({ centerVertexId: V['t-center'] });
        editor.keyDown({ key: ' ' });
        expect(editor.snapshot.command).toBeNull();
        expect(history.undoCommand?.label).toBe('GRIP_MOVE');
    });

    it('ends with eXit and changes nothing', () => {
        const { editor, radius } = hotQuadrant();
        type(editor, 'x');
        expect(editor.snapshot).toMatchObject({ command: null, message: null, canUndo: false });
        expect(radius()).toBe(600);
        expect([...editor.snapshot.highlighted]).toEqual([E.table]);
    });

    it('takes an option typed into the Dynamic Input fields', () => {
        const { editor } = hotQuadrant(true);
        editor.pointerMove(at(TARGET));
        type(editor, 'k');
        expect(editor.snapshot.prompt).toBe(`** STRECKEN (mehrere) ** Streckpunkt angeben oder ${OPTIONS}`);
    });
});

describe('grips: reference', () => {
    const NEW_ANGLE = `** DREHEN ** Neuen Winkel angeben oder ${MEASURED_OPTIONS}`;
    const NEW_LENGTH = `** SKALIEREN ** Neue Länge angeben oder ${MEASURED_OPTIONS}`;
    /** Empty space in the middle of the room, where nothing snaps. */
    const P1 = { x: 3000, y: 2000 };

    it('has no option BEzug where nothing is measured', () => {
        const { editor } = hotQuadrant();
        type(editor, 'be');
        expect(editor.snapshot).toMatchObject({ prompt: STRETCH_PROMPT, message: 'Punkt oder Option-Schlüsselwort erforderlich.' });
    });

    it('turns from a typed reference angle to the new angle', () => {
        const { editor, vertex } = hotWindowEnd();
        enter(editor, 2);
        type(editor, 'be');
        expect(editor.snapshot).toMatchObject({ prompt: '** DREHEN ** Bezugswinkel angeben <0>:', from: null });
        type(editor, '30');
        expect(editor.snapshot).toMatchObject({ prompt: NEW_ANGLE, from: WINDOW_END });
        type(editor, '120');
        expect(vertex(V['win-1'])).toEqual({ x: 5000, y: 2380 });
    });

    it('takes the reference angle from two points', () => {
        const { editor, vertex } = hotWindowEnd();
        enter(editor, 2);
        type(editor, 'be');
        click(editor, P1);
        expect(editor.snapshot).toMatchObject({ prompt: '** DREHEN ** Zweiten Punkt angeben:', from: P1 });
        // Straight up: 90°
        click(editor, { x: 3000, y: 2500 });
        expect(editor.snapshot.prompt).toBe(NEW_ANGLE);
        type(editor, '180');
        expect(vertex(V['win-1'])).toEqual({ x: 5000, y: 2380 });
    });

    it('previews the turn from the reference angle, and takes Enter as its default 0', () => {
        const { editor, vertex } = hotWindowEnd();
        enter(editor, 2);
        type(editor, 'be');
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot.prompt).toBe(NEW_ANGLE);
        type(editor, 'be');
        type(editor, '180');
        editor.pointerMove(at({ x: 5000, y: 3000 }));
        const { preview, previewPoint } = editor.snapshot;
        if (typeof preview !== 'object' || preview?.kind !== 'transform') {
            throw new Error('no transform preview');
        }
        // The cursor at 270° turns by 90° from the reference 180°
        expect(preview.matrixAt(previewPoint!)?.slice(0, 4)).toEqual([0, 1, -1, 0]);
        type(editor, '270');
        expect(vertex(V['win-1'])).toEqual({ x: 5000, y: 2380 });
    });

    it('scales by the ratio of the new length to a typed reference length', () => {
        const { editor, radius } = hotQuadrant();
        enter(editor, 3);
        type(editor, 'be');
        expect(editor.snapshot).toMatchObject({ prompt: '** SKALIEREN ** Bezugslänge angeben <1.0000>:', from: null });
        type(editor, '0');
        expect(editor.snapshot.message).toBe('Wert muss positiv und ungleich Null sein.');
        type(editor, '600');
        expect(editor.snapshot.prompt).toBe(NEW_LENGTH);
        type(editor, '300');
        expect(radius()).toBe(300);
    });

    it('takes the reference length from two points, and the new one from the base point to a point', () => {
        const { editor, radius } = hotQuadrant();
        enter(editor, 3);
        type(editor, 'be');
        click(editor, P1);
        expect(editor.snapshot.prompt).toBe('** SKALIEREN ** Zweiten Punkt angeben:');
        click(editor, { x: 3350, y: 2000 });
        expect(editor.snapshot.prompt).toBe(NEW_LENGTH);
        // 700 from the grip, against the reference 350
        click(editor, TARGET);
        expect(radius()).toBe(1200);
    });

    it('needs no fields of the Dynamic Input for a reference length typed without a point', () => {
        const { editor, radius } = hotQuadrant(true);
        enter(editor, 3);
        type(editor, 'be');
        editor.pointerMove(at(P1));
        expect(editor.snapshot.dynamicInput).toBeNull();
        type(editor, '2');
        type(editor, '4');
        expect(radius()).toBe(1200);
    });

    it('drops the reference when the mode changes', () => {
        const { editor } = hotWindowEnd();
        enter(editor, 2);
        type(editor, 'be');
        type(editor, '30');
        enter(editor, 5);
        expect(editor.snapshot.prompt).toBe(ROTATE_PROMPT);
    });

    it('keeps the reference for every copy', () => {
        const { editor, history } = hotWindowEnd();
        enter(editor, 2);
        type(editor, 'k');
        type(editor, 'be');
        type(editor, '30');
        type(editor, '120');
        type(editor, '210');
        expect(editor.snapshot.prompt).toBe(`** DREHEN (mehrere) ** Neuen Winkel angeben oder ${MEASURED_OPTIONS}`);
        const ends = history.document.elements.slice(-2).map((line) => {
            const start = (line as { startVertexId: string }).startVertexId;
            const { x, y } = history.document.vertices.find((v) => v.id === start)!;
            return { x: Math.round(x), y: Math.round(y) };
        });
        expect(ends).toEqual([
            { x: 5000, y: 2380 },
            { x: 6500, y: 3880 },
        ]);
    });
});
