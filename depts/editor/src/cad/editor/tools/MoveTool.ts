import { t } from '../../../i18n/i18n';
import type { Id, Point } from '../../model/Point';
import { matchesKeyword } from '../commandInput';
import { commandName } from '../commandNames';
import { MoveCommand } from '../commands/MoveCommand';
import type { EditorTool, ToolPrompt, ToolStep } from './EditorTool';

const NOTHING: ReadonlySet<Id> = new Set();

type State =
    | { kind: 'select' }
    | { kind: 'basePoint'; selection: ReadonlySet<Id> }
    | { kind: 'secondPoint'; selection: ReadonlySet<Id>; basePoint: Point }
    /** Option "Verschiebung": the displacement vector; a click gives it as a point. */
    | { kind: 'displacement'; selection: ReadonlySet<Id> };

/**
 * SCHIEBEN (AutoCAD MOVE): takes over the pickfirst selection and asks for the base point right
 * away; without one it first asks for objects. Then the second point, and the selection moves
 * by (second point − base point) as one undo step (see MoveCommand). Enter on its own (or "V")
 * at the base point asks for the displacement vector instead, and at the second point takes the
 * base point itself as the displacement, like AutoCAD.
 */
export class MoveTool implements EditorTool {
    readonly command = 'MOVE';
    readonly preview = 'move';
    private state: State = { kind: 'select' };
    prompt: ToolPrompt = { kind: 'select', text: () => t('prompt.select', { command: commandName('MOVE') }) };

    get highlighted(): ReadonlySet<Id> {
        return this.state.kind === 'select' ? NOTHING : this.state.selection;
    }

    start(pickfirst: ReadonlySet<Id>): ToolStep {
        if (pickfirst.size === 0) {
            return {};
        }
        this.askBasePoint(pickfirst);
        return { message: () => t('message.found', { count: pickfirst.size }) };
    }

    objectsSelected(selection: ReadonlySet<Id>): ToolStep {
        this.askBasePoint(selection);
        return {};
    }

    point(point: Point): ToolStep {
        const state = this.state;
        switch (state.kind) {
            case 'basePoint':
                this.state = { kind: 'secondPoint', selection: state.selection, basePoint: point };
                this.prompt = { kind: 'point', input: 'next', from: point, text: () => t('prompt.secondPoint') };
                return {};
            case 'secondPoint':
                return moveBy(state.selection, { x: point.x - state.basePoint.x, y: point.y - state.basePoint.y });
            case 'displacement':
                return moveBy(state.selection, point);
            case 'select':
                return {};
        }
    }

    text(text: string): ToolStep | null {
        const state = this.state;
        if (state.kind === 'basePoint' && (text === '' || matchesKeyword(text, t('message.displacementKeyword')))) {
            this.state = { kind: 'displacement', selection: state.selection };
            this.prompt = { kind: 'point', input: 'vector', from: null, text: () => t('prompt.displacement') };
            return {};
        }
        if (text !== '') {
            return null;
        }
        if (state.kind === 'secondPoint') {
            // The base point as displacement
            return moveBy(state.selection, state.basePoint);
        }
        // The default <0,0>
        return state.kind === 'displacement' ? moveBy(state.selection, { x: 0, y: 0 }) : null;
    }

    cancel(): void {}

    private askBasePoint(selection: ReadonlySet<Id>): void {
        this.state = { kind: 'basePoint', selection };
        this.prompt = { kind: 'point', input: 'point', from: null, text: () => t('prompt.basePoint') };
    }
}

/** Ends SCHIEBEN; a zero displacement changes nothing, so it leaves no undo step either. */
function moveBy(selection: ReadonlySet<Id>, delta: Point): ToolStep {
    return { done: true, command: delta.x !== 0 || delta.y !== 0 ? new MoveCommand(selection, delta) : undefined };
}
