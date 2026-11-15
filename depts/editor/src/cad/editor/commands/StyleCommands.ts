import type { CadDocument } from '../../model/CadDocument';
import type { ElementStyle } from '../../model/ElementStyle';
import type { Id } from '../../model/Point';
import type { DocumentChange, DocumentCommand } from './DocumentCommand';

/** What of a style can change; its id stays. */
export type StyleChanges = Partial<Omit<ElementStyle, 'id'>>;

/** The elements that have the style: they are drawn anew when it changes. */
function elementsOf(doc: CadDocument, styleId: Id): Id[] {
    return doc.elements.filter((element) => element.styleId === styleId).map((element) => element.id);
}

/** Adds a style; no element has it yet. */
export class AddStyleCommand implements DocumentCommand {
    readonly label = 'STYLE';
    readonly style: ElementStyle;

    constructor(style: ElementStyle) {
        this.style = style;
    }

    execute(doc: CadDocument): DocumentChange {
        return { document: { ...doc, styles: [...doc.styles, this.style] }, changedElementIds: [] };
    }

    undo(doc: CadDocument): DocumentChange {
        return { document: { ...doc, styles: doc.styles.filter((style) => style.id !== this.style.id) }, changedElementIds: [] };
    }
}

/**
 * Changes properties of a style; the elements that have it are reported as changed. `undo` puts
 * back only the properties it changed. A style that is gone changes nothing.
 */
export class UpdateStyleCommand implements DocumentCommand {
    readonly label = 'STYLE';
    readonly styleId: Id;
    readonly changes: StyleChanges;
    /** The values the changed properties had before the first run. */
    private before: StyleChanges | null = null;

    constructor(styleId: Id, changes: StyleChanges) {
        this.styleId = styleId;
        this.changes = changes;
    }

    execute(doc: CadDocument): DocumentChange {
        const style = doc.styles.find((candidate) => candidate.id === this.styleId);
        if (style && this.before === null) {
            const keys = Object.keys(this.changes) as (keyof StyleChanges)[];
            this.before = Object.fromEntries(keys.map((key) => [key, style[key]]));
        }
        return this.apply(doc, this.changes);
    }

    undo(doc: CadDocument): DocumentChange {
        return this.apply(doc, this.before ?? {});
    }

    private apply(doc: CadDocument, changes: StyleChanges): DocumentChange {
        if (!doc.styles.some((style) => style.id === this.styleId)) {
            return { document: doc, changedElementIds: [] };
        }
        const styles = doc.styles.map((style) => (style.id === this.styleId ? { ...style, ...changes } : style));
        return { document: { ...doc, styles }, changedElementIds: elementsOf(doc, this.styleId) };
    }
}

/**
 * Removes a style; the elements that had it have none then. `undo` puts the style back at its
 * place and gives it back to those of them that still have none.
 */
export class RemoveStyleCommand implements DocumentCommand {
    readonly label = 'STYLE';
    readonly styleId: Id;
    private removed: { style: ElementStyle; index: number; elementIds: ReadonlySet<Id> } | null = null;

    constructor(styleId: Id) {
        this.styleId = styleId;
    }

    execute(doc: CadDocument): DocumentChange {
        const index = doc.styles.findIndex((style) => style.id === this.styleId);
        if (index < 0) {
            this.removed = null;
            return { document: doc, changedElementIds: [] };
        }
        const elementIds = elementsOf(doc, this.styleId);
        this.removed = { style: doc.styles[index], index, elementIds: new Set(elementIds) };
        return {
            document: {
                ...doc,
                styles: doc.styles.filter((style) => style.id !== this.styleId),
                elements: elementIds.length === 0 ? doc.elements : doc.elements.map((element) => (element.styleId === this.styleId ? { ...element, styleId: null } : element)),
            },
            changedElementIds: elementIds,
        };
    }

    undo(doc: CadDocument): DocumentChange {
        const removed = this.removed;
        if (removed === null || doc.styles.some((style) => style.id === this.styleId)) {
            return { document: doc, changedElementIds: [] };
        }
        const back: Id[] = [];
        const elements = doc.elements.map((element) => {
            if (!removed.elementIds.has(element.id) || element.styleId !== null) {
                return element;
            }
            back.push(element.id);
            return { ...element, styleId: this.styleId };
        });
        return {
            document: { ...doc, styles: doc.styles.toSpliced(removed.index, 0, removed.style), elements: back.length === 0 ? doc.elements : elements },
            changedElementIds: back,
        };
    }
}

/**
 * Gives elements a style, or none with null. Those that have it already or are gone stay as they
 * are, and so does everything if the style is gone. `undo` gives each back the style it had,
 * where that still exists and the element still has what this command gave it.
 */
export class AssignStyleCommand implements DocumentCommand {
    readonly label = 'STYLE';
    readonly styleId: Id | null;
    private readonly elementIds: ReadonlySet<Id>;
    /** The style each changed element had before the last run. */
    private previous: ReadonlyMap<Id, Id | null> = new Map();

    constructor(elementIds: Iterable<Id>, styleId: Id | null) {
        this.elementIds = new Set(elementIds);
        this.styleId = styleId;
    }

    execute(doc: CadDocument): DocumentChange {
        const previous = new Map<Id, Id | null>();
        this.previous = previous;
        if (this.styleId !== null && !doc.styles.some((style) => style.id === this.styleId)) {
            return { document: doc, changedElementIds: [] };
        }
        const elements = doc.elements.map((element) => {
            if (!this.elementIds.has(element.id) || element.styleId === this.styleId) {
                return element;
            }
            previous.set(element.id, element.styleId);
            return { ...element, styleId: this.styleId };
        });
        return previous.size === 0 ? { document: doc, changedElementIds: [] } : { document: { ...doc, elements }, changedElementIds: [...previous.keys()] };
    }

    undo(doc: CadDocument): DocumentChange {
        const styleIds = new Set(doc.styles.map((style) => style.id));
        const back: Id[] = [];
        const elements = doc.elements.map((element) => {
            const styleId = this.previous.get(element.id);
            if (styleId === undefined || element.styleId !== this.styleId || (styleId !== null && !styleIds.has(styleId))) {
                return element;
            }
            back.push(element.id);
            return { ...element, styleId };
        });
        return back.length === 0 ? { document: doc, changedElementIds: [] } : { document: { ...doc, elements }, changedElementIds: back };
    }
}
