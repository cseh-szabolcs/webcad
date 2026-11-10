import type { CadDocument } from '../model/CadDocument';
import type { CadElement } from '../model/CadElement';
import type { DocumentIndex } from '../model/DocumentIndex';
import type { Id } from '../model/Point';

/** One change to the rendered scene; `add` goes below `beforeId`, or on top of its layer for null. */
export type SceneStep =
    | { kind: 'remove'; id: Id }
    | { kind: 'replace'; id: Id }
    | { kind: 'add'; id: Id; beforeId: Id | null };

/**
 * What a renderer showing the elements `drawn` has to do to show `doc`, given the elements a
 * command changed: removals, then replacements, then additions in document order, so the
 * drawing order stays that of the document (layer by layer, within a layer in document order).
 * `'rebuild'` if the changed ids do not account for the difference.
 */
export function planSceneUpdate(
    doc: CadDocument,
    index: DocumentIndex,
    drawn: { has(id: Id): boolean; readonly size: number },
    changedIds: Iterable<Id>,
): SceneStep[] | 'rebuild' {
    const removed: SceneStep[] = [];
    const replaced: SceneStep[] = [];
    const added = new Set<Id>();
    for (const id of new Set(changedIds)) {
        const exists = index.elements.has(id);
        if (exists && drawn.has(id)) {
            replaced.push({ kind: 'replace', id });
        } else if (exists) {
            added.add(id);
        } else if (drawn.has(id)) {
            removed.push({ kind: 'remove', id });
        }
    }
    if (drawn.size - removed.length + added.size !== index.elements.size) {
        return 'rebuild';
    }
    return [...removed, ...replaced, ...additions(doc, index, drawn, added)];
}

/** The added elements in document order, each with the drawn element of its layer that follows it. */
function additions(
    doc: CadDocument,
    index: DocumentIndex,
    drawn: { has(id: Id): boolean },
    added: ReadonlySet<Id>,
): SceneStep[] {
    const steps: SceneStep[] = [];
    /** Per layer, the nearest drawn element after the current position. */
    const next = new Map<Id | null, Id>();
    // From the end, as new elements are usually the last ones
    for (let i = doc.elements.length - 1; i >= 0 && steps.length < added.size; i--) {
        const element = doc.elements[i];
        const layer = sceneLayer(element, index);
        if (added.has(element.id)) {
            steps.push({ kind: 'add', id: element.id, beforeId: next.get(layer) ?? null });
        } else if (drawn.has(element.id)) {
            next.set(layer, element.id);
        }
    }
    return steps.reverse();
}

/** The layer an element is drawn on: its own if the document knows it, else none (null). */
function sceneLayer(element: CadElement, index: DocumentIndex): Id | null {
    return element.layerId !== null && index.layers.has(element.layerId) ? element.layerId : null;
}
