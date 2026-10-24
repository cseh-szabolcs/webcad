import type { CadDocument } from '../../model/CadDocument';
import type { DocumentChange, DocumentCommand } from './DocumentCommand';

/**
 * The current document with undo and redo. Every persistent model change runs through
 * `execute`; listeners hear about each new document with the elements that changed.
 */
export class DocumentHistory {
    private current: CadDocument;
    private readonly done: DocumentCommand[] = [];
    private readonly undone: DocumentCommand[] = [];
    private readonly listeners = new Set<(change: DocumentChange) => void>();

    constructor(doc: CadDocument) {
        this.current = doc;
    }

    get document(): CadDocument {
        return this.current;
    }

    /** The command undo would revert, or null. */
    get undoCommand(): DocumentCommand | null {
        return this.done.at(-1) ?? null;
    }

    /** The command redo would run again, or null. */
    get redoCommand(): DocumentCommand | null {
        return this.undone.at(-1) ?? null;
    }

    /** Listeners are called in the order they subscribed. */
    subscribe(listener: (change: DocumentChange) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /** Runs the command as one undo step; a new step drops what was undone before. */
    execute(command: DocumentCommand): void {
        this.undone.length = 0;
        this.done.push(command);
        this.apply(command.execute(this.current));
    }

    /** Reverts the last command; returns it, or null if there is nothing to undo. */
    undo(): DocumentCommand | null {
        const command = this.done.pop();
        if (!command) {
            return null;
        }
        this.undone.push(command);
        this.apply(command.undo(this.current));
        return command;
    }

    /** Runs the last undone command again; returns it, or null if there is nothing to redo. */
    redo(): DocumentCommand | null {
        const command = this.undone.pop();
        if (!command) {
            return null;
        }
        this.done.push(command);
        this.apply(command.execute(this.current));
        return command;
    }

    private apply(change: DocumentChange): void {
        this.current = change.document;
        this.listeners.forEach((listener) => listener(change));
    }
}
