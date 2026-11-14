import { t } from '../../../i18n/i18n';
import type { DocumentIndex } from '../../model/DocumentIndex';
import type { Id } from '../../model/Point';
import { commandName } from '../commandNames';
import { SubtractCommand } from '../commands/SubtractCommand';
import { objectsWithArea, skippedMessage } from './areaObjects';
import type { EditorTool, ToolPrompt, ToolStep } from './EditorTool';

const NOTHING: ReadonlySet<Id> = new Set();

type State = { kind: 'minuends' } | { kind: 'subtrahends'; minuends: ReadonlySet<Id> };

/**
 * DIFFERENZ (AutoCAD SUBTRACT): asks for the objects to subtract from, which the pickfirst
 * selection is if there is one, then for the objects to subtract, and replaces them all by the
 * outlines of what is left as one undo step (see SubtractCommand). AutoCAD takes regions; here
 * closed polylines and circles bound an area, and anything else selected is passed over with a
 * message. Without such an object in a selection the command ends and changes nothing.
 */
export class SubtractTool implements EditorTool {
    readonly command = 'SUBTRACT';
    readonly preview = null;
    private readonly index: DocumentIndex;
    private state: State = { kind: 'minuends' };
    prompt: ToolPrompt = { kind: 'select', text: () => t('prompt.subtractFrom', { command: commandName('SUBTRACT') }) };

    /** `index` is the document the objects are selected in; it does not change while the tool runs. */
    constructor(index: DocumentIndex) {
        this.index = index;
    }

    /** The objects to subtract from stay shown as selected while the others are chosen. */
    get highlighted(): ReadonlySet<Id> {
        return this.state.kind === 'subtrahends' ? this.state.minuends : NOTHING;
    }

    start(pickfirst: ReadonlySet<Id>): ToolStep {
        if (pickfirst.size === 0) {
            return {};
        }
        const step = this.takeMinuends(pickfirst);
        return step.done || step.message ? step : { message: () => t('message.found', { count: pickfirst.size }) };
    }

    objectsSelected(selection: ReadonlySet<Id>): ToolStep {
        const state = this.state;
        if (state.kind === 'minuends') {
            return this.takeMinuends(selection);
        }
        // One of the objects to subtract from stays one
        const others = new Set([...selection].filter((id) => !state.minuends.has(id)));
        const subtrahends = objectsWithArea(others, this.index);
        if (subtrahends.size === 0) {
            return { done: true, message: () => t('message.subtractNothing') };
        }
        return {
            done: true,
            message: skippedMessage(others.size - subtrahends.size),
            command: new SubtractCommand(state.minuends, subtrahends, commandName('SUBTRACT')),
        };
    }

    point(): ToolStep {
        return {};
    }

    distance(): ToolStep {
        return {};
    }

    text(): ToolStep | null {
        return null;
    }

    cancel(): void {}

    private takeMinuends(selection: ReadonlySet<Id>): ToolStep {
        const minuends = objectsWithArea(selection, this.index);
        if (minuends.size === 0) {
            return { done: true, message: () => t('message.subtractNothing') };
        }
        this.state = { kind: 'subtrahends', minuends };
        this.prompt = { kind: 'select', text: () => t('prompt.subtractObjects') };
        return { message: skippedMessage(selection.size - minuends.size) };
    }
}
