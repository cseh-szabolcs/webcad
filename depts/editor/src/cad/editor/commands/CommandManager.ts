import type { CadDocument } from '../../model/CadDocument';
import type { Command, CommandResult } from './Command';

/** Undo/redo history. The document itself is owned by the caller. */
export class CommandManager {
    private undoStack: Command[] = [];
    private redoStack: Command[] = [];

    execute(command: Command, doc: CadDocument): CommandResult {
        const result = command.execute(doc);
        this.undoStack.push(command);
        this.redoStack = [];
        return result;
    }

    undo(doc: CadDocument): CommandResult | null {
        const command = this.undoStack.pop();
        if (!command) {
            return null;
        }
        this.redoStack.push(command);
        return command.undo(doc);
    }

    redo(doc: CadDocument): CommandResult | null {
        const command = this.redoStack.pop();
        if (!command) {
            return null;
        }
        this.undoStack.push(command);
        return command.execute(doc);
    }

    clear(): void {
        this.undoStack = [];
        this.redoStack = [];
    }

    get canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    get canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    get undoLabel(): string | null {
        return this.undoStack.at(-1)?.label ?? null;
    }

    get redoLabel(): string | null {
        return this.redoStack.at(-1)?.label ?? null;
    }
}
