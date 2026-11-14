import { t } from '../../../i18n/i18n';
import { reflectionAcross, type Similarity } from '../../geometry/similarity';
import type { Id, Point } from '../../model/Point';
import { matchesKeyword } from '../commandInput';
import { commandName } from '../commandNames';
import { CopyCommand } from '../commands/CopyCommand';
import { TransformCommand, transformElement } from '../commands/TransformCommand';
import type { EditorTool, ToolPreview, ToolPrompt, ToolStep } from './EditorTool';
import { transformPreview } from './GripTool';

const NOTHING: ReadonlySet<Id> = new Set();

type State =
    | { kind: 'select' }
    | { kind: 'firstPoint'; selection: ReadonlySet<Id> }
    | { kind: 'secondPoint'; selection: ReadonlySet<Id>; first: Point }
    /** "Quellobjekte löschen?": the mirror line is given. */
    | { kind: 'erase'; selection: ReadonlySet<Id>; mirror: Similarity };

/**
 * SPIEGELN (AutoCAD MIRROR): takes over the pickfirst selection or asks for objects, then for the
 * two points of the mirror line (the line through them, however far apart), previewing the mirror
 * images, and last whether the originals go. They stay by default (a CopyCommand); with "Ja" they
 * are mirrored themselves (a TransformCommand). One undo step either way.
 */
export class MirrorTool implements EditorTool {
    readonly command = 'MIRROR';
    /** The originals stay unless the last prompt says otherwise, so the preview shows them too. */
    readonly keepsOriginals = true;
    preview: ToolPreview | null = null;
    private state: State = { kind: 'select' };
    prompt: ToolPrompt = { kind: 'select', text: () => t('prompt.select', { command: commandName('MIRROR') }) };

    get highlighted(): ReadonlySet<Id> {
        return this.state.kind === 'select' ? NOTHING : this.state.selection;
    }

    start(pickfirst: ReadonlySet<Id>): ToolStep {
        if (pickfirst.size === 0) {
            return {};
        }
        this.askFirstPoint(pickfirst);
        return { message: () => t('message.found', { count: pickfirst.size }) };
    }

    objectsSelected(selection: ReadonlySet<Id>): ToolStep {
        this.askFirstPoint(selection);
        return {};
    }

    point(point: Point): ToolStep {
        const state = this.state;
        if (state.kind === 'firstPoint') {
            const first = point;
            this.state = { kind: 'secondPoint', selection: state.selection, first };
            this.prompt = { kind: 'point', input: 'next', from: first, text: () => t('prompt.mirrorSecondPoint') };
            this.preview = transformPreview((second) => reflectionAcross(first, second));
            return {};
        }
        if (state.kind !== 'secondPoint') {
            return {};
        }
        const mirror = reflectionAcross(state.first, point);
        if (mirror === null) {
            return { message: () => t('message.mirrorSamePoint') };
        }
        this.state = { kind: 'erase', selection: state.selection, mirror };
        this.prompt = { kind: 'keyword', text: () => t('prompt.mirrorErase'), preview: { from: state.first, point } };
        return {};
    }

    distance(): ToolStep {
        return {};
    }

    text(text: string): ToolStep | null {
        const state = this.state;
        if (state.kind !== 'erase') {
            return null;
        }
        const { selection, mirror } = state;
        if (text === '' || matchesKeyword(text, t('message.noKeyword'))) {
            const copy = new CopyCommand('MIRROR', (index) =>
                [...index.elements.values()]
                    .filter((element) => selection.has(element.id))
                    .map((element) => transformElement(element, index, mirror)),
            );
            return { done: true, command: copy };
        }
        if (matchesKeyword(text, t('message.yesKeyword'))) {
            return { done: true, command: new TransformCommand('MIRROR', selection, mirror) };
        }
        return null;
    }

    cancel(): void {}

    private askFirstPoint(selection: ReadonlySet<Id>): void {
        this.state = { kind: 'firstPoint', selection };
        this.prompt = { kind: 'point', input: 'point', from: null, text: () => t('prompt.mirrorFirstPoint') };
    }
}
