import type { CadDocument } from '../../model/CadDocument';
import type { CadElement } from '../../model/CadElement';
import type { ElementAppearance } from '../../model/ElementAppearance';
import type { Id } from '../../model/Point';
import type { DocumentChange, DocumentCommand } from './DocumentCommand';

/** Which overrides to set: a value, or null to take the style's or the layer's again. */
export type AppearanceChanges = Partial<ElementAppearance>;

/**
 * Sets what elements override of colour, linetype, lineweight and transparency, like changing
 * them in AutoCAD's properties while objects are selected. Elements that have the values already
 * or are gone stay as they are. `undo` puts back, per element, each value it changed that is still
 * the one it set, so what somebody else changed on the element meanwhile stays.
 */
export class ElementAppearanceCommand implements DocumentCommand {
    readonly label = 'PROPERTIES';
    readonly changes: AppearanceChanges;
    private readonly elementIds: ReadonlySet<Id>;
    /** Per changed element, the values the changed properties had before the last run. */
    private previous: ReadonlyMap<Id, AppearanceChanges> = new Map();

    constructor(elementIds: Iterable<Id>, changes: AppearanceChanges) {
        this.elementIds = new Set(elementIds);
        this.changes = changes;
    }

    execute(doc: CadDocument): DocumentChange {
        const previous = new Map<Id, AppearanceChanges>();
        this.previous = previous;
        const keys = Object.keys(this.changes) as (keyof ElementAppearance)[];
        const elements = doc.elements.map((element): CadElement => {
            const changed = this.elementIds.has(element.id) ? keys.filter((key) => element[key] !== this.changes[key]) : [];
            if (changed.length === 0) {
                return element;
            }
            previous.set(element.id, Object.fromEntries(changed.map((key) => [key, element[key]])));
            return { ...element, ...Object.fromEntries(changed.map((key) => [key, this.changes[key]])) };
        });
        return previous.size === 0 ? { document: doc, changedElementIds: [] } : { document: { ...doc, elements }, changedElementIds: [...previous.keys()] };
    }

    undo(doc: CadDocument): DocumentChange {
        const back: Id[] = [];
        const elements = doc.elements.map((element): CadElement => {
            const before = this.previous.get(element.id);
            const keys = before ? (Object.keys(before) as (keyof ElementAppearance)[]).filter((key) => element[key] === this.changes[key]) : [];
            if (!before || keys.length === 0) {
                return element;
            }
            back.push(element.id);
            return { ...element, ...Object.fromEntries(keys.map((key) => [key, before[key]])) };
        });
        return back.length === 0 ? { document: doc, changedElementIds: [] } : { document: { ...doc, elements }, changedElementIds: back };
    }
}
