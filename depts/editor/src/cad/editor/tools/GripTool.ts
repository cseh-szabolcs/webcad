import { t } from '../../../i18n/i18n';
import { reflectionAcross, rotationAbout, scalingAbout, type Similarity } from '../../geometry/similarity';
import { vertexRefs, type CadElement } from '../../model/CadElement';
import type { DocumentIndex } from '../../model/DocumentIndex';
import type { Id, Point } from '../../model/Point';
import { buildPathSpec } from '../../renderer/PathSpec';
import { matchesKeyword } from '../commandInput';
import type { GripLabel } from '../commandNames';
import { CopyCommand } from '../commands/CopyCommand';
import { EditCommand } from '../commands/EditCommand';
import type { DocumentCommand } from '../commands/DocumentCommand';
import type { DocumentHistory } from '../commands/DocumentHistory';
import { samePosition, type ElementEdit } from '../commands/elementEdits';
import { MoveCommand, translateElement } from '../commands/MoveCommand';
import { AddPolylineVertexCommand, SetPolylineBulgeCommand, withVertexAt } from '../commands/PolylineVertexCommands';
import { StretchCommand } from '../commands/StretchCommand';
import { TransformCommand, transformElement } from '../commands/TransformCommand';
import {
    arcConversion,
    gripActions,
    IMMEDIATE_GRIP_ACTIONS,
    lengthenEdits,
    radiusCenter,
    radiusEdits,
    vertexInsertion,
    type GripAction,
} from '../grips/actions';
import { stretchTargets } from '../grips/stretch';
import type { Grip } from '../selection/grips';
import type { EditorTool, PreviewElement, PreviewMatrix, ToolPreview, ToolPrompt, ToolStep } from './EditorTool';

const NOTHING: ReadonlySet<Id> = new Set();

/** The grip modes in the order Enter, Space or a right click goes through them, like AutoCAD. */
export const GRIP_MODES = ['stretch', 'move', 'rotate', 'scale', 'mirror'] as const;
export type GripMode = (typeof GRIP_MODES)[number];

/**
 * What the tool asks for: the point, angle or factor of its mode; another base point; the
 * reference angle or length (a number, or the first of two points); the second of those points.
 */
type Ask = 'mode' | 'basePoint' | 'reference' | { secondOf: Point };

/** What a mode does with the input given: to the originals, or as edits for their copies. */
interface Operation {
    label: GripLabel;
    command: () => DocumentCommand;
    edits: (index: DocumentIndex) => readonly ElementEdit[];
}

/**
 * Editing with grips like AutoCAD: a click on a grip makes it hot, the base point of what
 * follows as one undo step. It starts in the mode STRETCH, which changes only the elements of
 * the hot grips (see stretchTargets); Enter on its own (also Space or a right click) goes on to
 * MOVE, ROTATE, SCALE and MIRROR and round again, which work on the whole selection:
 * - MOVE: by the next point given, measured from the base point;
 * - ROTATE: about the base point by a typed angle, or the direction from it to a point given;
 * - SCALE: from the base point by a typed factor, or the distance from it to a point given
 *   (in drawing units, like AutoCAD);
 * - MIRROR: across the line from the base point to the point given; the originals do not stay.
 * The selection stays highlighted, and the editor keeps it afterwards.
 *
 * Options in every mode: another base point than the grip; Copy, after which the originals stay,
 * every input adds a copy at once (see CopyCommand) and Enter ends instead of changing the mode;
 * Undo, which takes back the last copy or base point; eXit. ROTATE and SCALE also take a
 * reference, a number or two points: the angle given then turns from the reference angle, the
 * length given scales by its ratio to the reference length. The copies of one run are one undo
 * step together, also after Esc.
 *
 * A single hot grip of one element may do something else in place of STRETCH (see GripAction):
 * chosen from the grip's menu, or by Ctrl, which goes through its actions. These take their
 * point (the radius: a distance from the arc's centre) and end; they have no options.
 */
export class GripTool implements EditorTool {
    readonly command = 'GRIP_EDIT';
    prompt!: ToolPrompt;
    preview: ToolPreview | null = null;
    private readonly history: DocumentHistory;
    private readonly index: DocumentIndex;
    private readonly grips: readonly Grip[];
    /** The base point of every mode: the first hot grip, until the option gives another. */
    private base: Point;
    private selection: ReadonlySet<Id> = NOTHING;
    private current: GripMode = 'stretch';
    private asking: Ask = 'mode';
    /** Option Copy is on. */
    private multiple = false;
    /** ROTATE: the reference angle in degrees; SCALE: the reference length; null without one. */
    private reference: number | null = null;
    /** What Undo takes back, in order: a copy, or the base point there was before. */
    private readonly steps: ('copy' | { base: Point })[] = [];
    /** Copies in the history, which become one undo step named `copyLabel`. */
    private copies = 0;
    private copyLabel: GripLabel = 'GRIP_STRETCH';
    /** What the mode STRETCH does, and what else it could do instead (those that take a point). */
    private action: GripAction;
    private readonly actions: readonly GripAction[];

    /** `index` is the document the grips were taken from; the originals never change while the tool runs. */
    constructor(history: DocumentHistory, index: DocumentIndex, grips: readonly Grip[], action: GripAction = 'stretch') {
        this.history = history;
        this.index = index;
        this.grips = grips;
        this.base = grips[0].point;
        const actions = grips.length === 1 ? gripActions(grips[0], index) : ['stretch' as const];
        this.actions = actions.filter((candidate) => !IMMEDIATE_GRIP_ACTIONS.includes(candidate));
        this.action = this.actions.includes(action) ? action : 'stretch';
        this.ask('mode');
    }

    /** Ctrl: the next action of the hot grip, while the mode STRETCH asks for its point. */
    cycle(): ToolStep | null {
        if (this.asking !== 'mode' || this.current !== 'stretch' || this.multiple || this.actions.length < 2) {
            return null;
        }
        this.action = this.actions[(this.actions.indexOf(this.action) + 1) % this.actions.length];
        return this.ask('mode');
    }

    get mode(): GripMode {
        return this.current;
    }

    get highlighted(): ReadonlySet<Id> {
        return this.selection;
    }

    get keepsOriginals(): boolean {
        return this.multiple;
    }

    start(pickfirst: ReadonlySet<Id>): ToolStep {
        this.selection = pickfirst;
        return {};
    }

    objectsSelected(): ToolStep {
        return {};
    }

    point(point: Point): ToolStep {
        const asking = this.asking;
        if (asking === 'basePoint') {
            this.steps.push({ base: this.base });
            this.base = point;
            return this.ask('mode');
        }
        if (asking === 'reference') {
            return this.ask({ secondOf: point });
        }
        if (asking !== 'mode') {
            const first = asking.secondOf;
            const length = Math.hypot(point.x - first.x, point.y - first.y);
            if (this.current === 'scale' && length <= 0) {
                return { message: () => t('message.positiveValue') };
            }
            this.reference = this.current === 'scale' ? length : degreesTo(first, point);
            return this.ask('mode');
        }
        if (this.current === 'stretch' && this.action !== 'stretch') {
            return { done: true, command: this.actionCommand(point) };
        }
        const delta = { x: point.x - this.base.x, y: point.y - this.base.y };
        const moved = delta.x !== 0 || delta.y !== 0;
        switch (this.current) {
            case 'stretch': {
                // Nothing to do, or nowhere to go (see stretchTargets)
                const possible = moved && stretchTargets(this.index, this.grips, delta) !== null;
                return this.apply(
                    possible
                        ? {
                              label: 'GRIP_STRETCH',
                              command: () => new StretchCommand(this.grips, delta),
                              edits: (index) => stretchTargets(index, this.grips, delta) ?? [],
                          }
                        : null,
                );
            }
            case 'move':
                return this.apply(
                    moved
                        ? {
                              label: 'GRIP_MOVE',
                              command: () => new MoveCommand(this.selection, delta),
                              edits: (index) => this.selected(index).map((element) => translateElement(element, index, delta)),
                          }
                        : null,
                );
            case 'mirror':
                return this.transform('GRIP_MIRROR', reflectionAcross(this.base, point));
            case 'rotate':
            case 'scale':
                return {};
        }
    }

    /** SCALE: the reference length, the new length or the factor; never zero or negative. */
    distance(value: number): ToolStep {
        if (this.current === 'stretch' && this.action === 'radius' && this.asking === 'mode') {
            if (value <= 0) {
                return { message: () => t('message.positiveValue') };
            }
            const grip = this.grips[0];
            return { done: true, command: new EditCommand('GRIP_RADIUS', (index) => radiusEdits(index, grip, value) ?? []) };
        }
        if (this.current !== 'scale' || (this.asking !== 'mode' && this.asking !== 'reference')) {
            return {};
        }
        if (value <= 0) {
            return { message: () => t('message.positiveValue') };
        }
        if (this.asking === 'reference') {
            this.reference = value;
            return this.ask('mode');
        }
        const factor = value / (this.reference ?? 1);
        return this.transform('GRIP_SCALE', factor === 1 ? null : scalingAbout(this.base, factor));
    }

    /** ROTATE: the reference angle, or the angle to turn to from it. */
    angle(degrees: number): ToolStep {
        if (this.current !== 'rotate' || (this.asking !== 'mode' && this.asking !== 'reference')) {
            return {};
        }
        if (this.asking === 'reference') {
            this.reference = degrees;
            return this.ask('mode');
        }
        const turn = degrees - (this.reference ?? 0);
        return this.transform('GRIP_ROTATE', turn % 360 === 0 ? null : rotationAbout(this.base, turn));
    }

    text(text: string): ToolStep | null {
        if (this.asking === 'reference' && text === '') {
            // The defaults <0> and <1.0000>
            this.reference = this.current === 'scale' ? 1 : 0;
            return this.ask('mode');
        }
        if (this.asking !== 'mode') {
            return null;
        }
        if (text === '') {
            if (this.multiple) {
                return this.finish();
            }
            this.current = GRIP_MODES[(GRIP_MODES.indexOf(this.current) + 1) % GRIP_MODES.length];
            this.reference = null;
            return this.ask('mode');
        }
        if (this.current === 'stretch' && this.action !== 'stretch') {
            return null;
        }
        if (matchesKeyword(text, t('message.basePointKeyword'))) {
            return this.ask('basePoint');
        }
        if (matchesKeyword(text, t('message.copyKeyword'))) {
            this.multiple = true;
            return this.ask('mode');
        }
        if (matchesKeyword(text, t('message.undoKeyword'))) {
            return this.undo();
        }
        const measured = this.current === 'rotate' || this.current === 'scale';
        if (measured && matchesKeyword(text, t('message.referenceKeyword'))) {
            return this.ask('reference');
        }
        return matchesKeyword(text, t('message.exitKeyword')) ? this.finish() : null;
    }

    /** Esc: the copies made stay. */
    cancel(): void {
        this.finish();
    }

    /** Applies the operation: to the originals, which ends the editing, or with Copy as one more copy. */
    private apply(operation: Operation | null): ToolStep {
        if (!this.multiple) {
            return { done: true, command: operation?.command() };
        }
        if (operation) {
            this.history.execute(new CopyCommand(operation.label, operation.edits));
            this.steps.push('copy');
            this.copies++;
            this.copyLabel = operation.label;
        }
        return this.ask('mode');
    }

    /** What the action of the hot grip does with the point given; nothing where it changes nothing. */
    private actionCommand(point: Point): DocumentCommand | undefined {
        const grip = this.grips[0];
        if (this.action === 'lengthen') {
            const edits = lengthenEdits(this.index, grip, point);
            const end = edits && [...edits[0].vertices.values()][0];
            return end && !samePosition(end, grip.point)
                ? new EditCommand('GRIP_LENGTHEN', (index) => lengthenEdits(index, grip, point) ?? [])
                : undefined;
        }
        if (this.action === 'convertToArc') {
            const arc = arcConversion(this.index, grip, point);
            return arc ? new SetPolylineBulgeCommand(arc.polyline.id, arc.segment, arc.bulge) : undefined;
        }
        const insertion = this.action === 'addVertex' ? vertexInsertion(this.index, grip) : null;
        return insertion ? new AddPolylineVertexCommand(insertion.polyline.id, insertion.at, point) : undefined;
    }

    private transform(label: 'GRIP_ROTATE' | 'GRIP_SCALE' | 'GRIP_MIRROR', similarity: Similarity | null): ToolStep {
        return this.apply(
            similarity && {
                label,
                command: () => new TransformCommand(label, this.selection, similarity),
                edits: (index) => this.selected(index).map((element) => transformElement(element, index, similarity)),
            },
        );
    }

    private undo(): ToolStep {
        const step = this.steps.pop();
        if (step === undefined) {
            return { message: () => t('message.nothingToUndo') };
        }
        if (step === 'copy') {
            this.history.revertLast();
            this.copies--;
        } else {
            this.base = step.base;
        }
        return this.ask('mode');
    }

    /** Ends the editing: the copies of this run become one undo step. */
    private finish(): ToolStep {
        this.history.combineLast(this.copies, this.copyLabel);
        this.copies = 0;
        return { done: true };
    }

    private selected(index: DocumentIndex): CadElement[] {
        return [...this.selection].flatMap((id) => index.elements.get(id) ?? []);
    }

    /** Asks anew (a new prompt object starts a new point prompt) with the preview that goes with it. */
    private ask(asking: Ask): ToolStep {
        this.asking = asking;
        const mode = this.current;
        const headerKey = this.multiple ? 'prompt.gripHeaderMultiple' : 'prompt.gripHeader';
        const header = () => t(headerKey, { mode: t(`gripMode.${mode}`) });
        const prompt = (input: 'point' | 'next' | 'distance' | 'angle', from: Point | null, key: PromptKey) => {
            this.prompt = { kind: 'point', input, from, spaceEnters: true, text: () => t(`prompt.${key}`, { header: header() }) };
        };
        this.preview = null;
        if (asking === 'basePoint') {
            prompt('point', null, 'gripBasePoint');
        } else if (asking === 'reference') {
            // Without a point to measure from, so a point given is the first of two
            prompt(mode === 'scale' ? 'distance' : 'angle', null, mode === 'scale' ? 'gripReferenceLength' : 'gripReferenceAngle');
        } else if (asking !== 'mode') {
            prompt('next', asking.secondOf, 'gripSecondPoint');
            this.preview = { kind: 'curve', curveAt: () => null, rubberBand: true };
        } else {
            this.askMode(prompt);
        }
        return {};
    }

    private askMode(prompt: (input: 'next' | 'distance' | 'angle', from: Point, key: PromptKey) => void): void {
        const from = this.base;
        const reference = this.reference;
        const distance = (point: Point) => Math.hypot(point.x - from.x, point.y - from.y);
        const ids = new Set(this.grips.flatMap((grip) => grip.targets.map((target) => target.elementId)));
        switch (this.current) {
            case 'stretch': {
                const grip = this.grips[0];
                const center = this.action === 'radius' ? radiusCenter(this.index, grip) : null;
                if (this.action === 'lengthen') {
                    prompt('next', grip.point, 'gripLengthen');
                    this.preview = { kind: 'elements', ids, elementsAt: (point) => this.edited(lengthenEdits(this.index, grip, point)) };
                } else if (center !== null) {
                    prompt('distance', center, 'gripRadius');
                    const radius = (point: Point) => Math.hypot(point.x - center.x, point.y - center.y);
                    this.preview = {
                        kind: 'elements',
                        ids,
                        elementsAt: (point) => this.edited(radiusEdits(this.index, grip, radius(point))),
                    };
                } else if (this.action === 'addVertex') {
                    prompt('next', grip.point, 'gripAddVertex');
                    this.preview = { kind: 'elements', ids, elementsAt: (point) => this.withVertex(grip, point) };
                } else if (this.action === 'convertToArc') {
                    prompt('next', grip.point, 'gripConvertToArc');
                    this.preview = { kind: 'elements', ids, elementsAt: (point) => this.asArc(grip, point) };
                } else {
                    prompt('next', from, 'gripStretch');
                    this.preview = { kind: 'elements', ids, elementsAt: (point) => this.stretched(point) };
                }
                break;
            }
            case 'move':
                prompt('next', from, 'gripMove');
                this.preview = 'move';
                break;
            case 'rotate':
                prompt('angle', from, reference === null ? 'gripRotate' : 'gripRotateNew');
                this.preview = transformPreview((point) =>
                    distance(point) > 0 ? rotationAbout(from, degreesTo(from, point) - (reference ?? 0)) : null,
                );
                break;
            case 'scale':
                prompt('distance', from, reference === null ? 'gripScale' : 'gripScaleNew');
                this.preview = transformPreview((point) =>
                    distance(point) > 0 ? scalingAbout(from, distance(point) / (reference ?? 1)) : null,
                );
                break;
            case 'mirror':
                prompt('next', from, 'gripMirror');
                this.preview = transformPreview((point) => reflectionAcross(from, point));
                break;
        }
    }

    /** The stretched elements with the base point at `point`. */
    private stretched(point: Point): PreviewElement[] {
        return this.edited(stretchTargets(this.index, this.grips, { x: point.x - this.base.x, y: point.y - this.base.y }));
    }

    /** The polyline of the grip with a vertex more at `point`. */
    private withVertex(grip: Grip, point: Point): PreviewElement[] {
        const insertion = vertexInsertion(this.index, grip);
        if (insertion === null) {
            return [];
        }
        const { polyline, at } = insertion;
        const added = { id: '', ...point };
        const vertices = new Map([...polyline.vertexIds.map((id) => [id, this.index.vertices.get(id)!] as const), ['', added]]);
        const element = withVertexAt(polyline, at, '');
        return [{ id: polyline.id, path: buildPathSpec(element, { ...this.index, vertices }) }];
    }

    /** The polyline of the grip with its segment as an arc through `point`. */
    private asArc(grip: Grip, point: Point): PreviewElement[] {
        const arc = arcConversion(this.index, grip, point);
        if (arc === null) {
            return [];
        }
        const element = { ...arc.polyline, bulges: arc.polyline.bulges.with(arc.segment, arc.bulge) };
        return [{ id: element.id, path: buildPathSpec(element, this.index) }];
    }

    /** The paths of edited elements, each on its own vertices; none for edits that go nowhere. */
    private edited(edits: readonly ElementEdit[] | null): PreviewElement[] {
        return (edits ?? []).map(({ element, vertices }) => {
            const own = new Map(
                vertexRefs(element).map((id) => [id, { ...this.index.vertices.get(id)!, ...vertices.get(id) }]),
            );
            return { id: element.id, path: buildPathSpec(element, { ...this.index, vertices: own }) };
        });
    }
}

type PromptKey =
    | 'gripStretch'
    | 'gripMove'
    | 'gripRotate'
    | 'gripRotateNew'
    | 'gripScale'
    | 'gripScaleNew'
    | 'gripMirror'
    | 'gripBasePoint'
    | 'gripReferenceAngle'
    | 'gripReferenceLength'
    | 'gripSecondPoint'
    | 'gripLengthen'
    | 'gripRadius'
    | 'gripAddVertex'
    | 'gripConvertToArc';

/** Direction from `from` to `to` in degrees, counter-clockwise from +X. */
function degreesTo(from: Point, to: Point): number {
    return (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
}

function transformPreview(at: (point: Point) => Similarity | null): ToolPreview {
    return {
        kind: 'transform',
        matrixAt: (point): PreviewMatrix | null => {
            const s = at(point);
            return s && [s.a, s.b, s.c, s.d, s.tx, s.ty];
        },
    };
}
