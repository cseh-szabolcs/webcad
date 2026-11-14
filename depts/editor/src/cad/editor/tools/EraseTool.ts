import { t } from '../../../i18n/i18n';
import type { Id } from '../../model/Point';
import { commandName } from '../commandNames';
import { EraseCommand } from '../commands/EraseCommand';
import type { EditorTool, ToolPrompt, ToolStep } from './EditorTool';

const NOTHING: ReadonlySet<Id> = new Set();

/**
 * LÖSCHEN (AutoCAD ERASE): erases the pickfirst selection at once, or asks for objects and
 * erases them when the selection ends, without asking back; one undo step (see EraseCommand).
 */
export class EraseTool implements EditorTool {
    readonly command = 'ERASE';
    readonly preview = null;
    readonly highlighted = NOTHING;
    readonly prompt: ToolPrompt = { kind: 'select', text: () => t('prompt.select', { command: commandName('ERASE') }) };

    start(pickfirst: ReadonlySet<Id>): ToolStep {
        if (pickfirst.size === 0) {
            return {};
        }
        return { ...this.objectsSelected(pickfirst), message: () => t('message.found', { count: pickfirst.size }) };
    }

    objectsSelected(selection: ReadonlySet<Id>): ToolStep {
        return { done: true, command: new EraseCommand(selection) };
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
