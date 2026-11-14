import { t } from '../../../i18n/i18n';
import type { DocumentIndex } from '../../model/DocumentIndex';
import type { Id } from '../../model/Point';
import { commandName } from '../commandNames';
import { SubtractCommand } from '../commands/SubtractCommand';
import { objectsWithArea, skippedMessage } from './areaObjects';
import type { EditorTool, ToolPrompt, ToolStep } from './EditorTool';

const NOTHING: ReadonlySet<Id> = new Set();

/**
 * VEREINIG (AutoCAD UNION): asks for objects, or takes the pickfirst selection at once, and
 * replaces them by the outlines of their areas taken together as one undo step (see
 * SubtractCommand). As for DIFFERENZ, closed polylines and circles bound an area and anything
 * else selected is passed over with a message; with fewer than two such objects the command
 * ends and changes nothing, like AutoCAD.
 */
export class UnionTool implements EditorTool {
    readonly command = 'UNION';
    readonly preview = null;
    readonly highlighted = NOTHING;
    readonly prompt: ToolPrompt = { kind: 'select', text: () => t('prompt.select', { command: commandName('UNION') }) };
    private readonly index: DocumentIndex;

    /** `index` is the document the objects are selected in; it does not change while the tool runs. */
    constructor(index: DocumentIndex) {
        this.index = index;
    }

    start(pickfirst: ReadonlySet<Id>): ToolStep {
        return pickfirst.size === 0 ? {} : this.objectsSelected(pickfirst);
    }

    objectsSelected(selection: ReadonlySet<Id>): ToolStep {
        const objects = objectsWithArea(selection, this.index);
        if (objects.size < 2) {
            return { done: true, message: () => t('message.unionTooFew') };
        }
        return {
            done: true,
            message: skippedMessage(selection.size - objects.size),
            command: new SubtractCommand(objects, [], commandName('UNION'), 'UNION'),
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
}
