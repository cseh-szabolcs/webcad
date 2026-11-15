import type { CadDocument } from '../model/CadDocument';
import type { CadElement } from '../model/CadElement';
import type { DocumentIndex } from '../model/DocumentIndex';
import type { Layer } from '../model/Layer';
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

/** The layer an element is drawn on: its own if the document knows it, else the one for the rest (null). */
function sceneLayer(element: CadElement, index: DocumentIndex): Id | null {
    return index.layers.has(element.layerId) ? element.layerId : null;
}

/**
 * One change to the layers of the rendered scene: an empty layer goes; a new one goes below
 * `belowId`, or on top of all for null; a layer is shown or hidden; or its elements are drawn
 * anew, as its colour, linetype or transparency changed.
 */
export type LayerStep =
    | { kind: 'remove'; id: Id }
    | { kind: 'add'; id: Id; belowId: Id | null }
    | { kind: 'show'; id: Id; visible: boolean }
    | { kind: 'restyle'; id: Id };

/**
 * What a renderer showing the layers `before` has to do to show the layers `after`, without
 * touching the elements: removals, then additions from the top down (so the layer a new one goes
 * below is there), then what changed on the layers that stay. `'rebuild'` if the layers that stay
 * changed their order, or one that goes still has elements drawn (`hasElements`).
 */
export function planLayerUpdate(
    before: readonly Layer[],
    after: readonly Layer[],
    hasElements: (id: Id) => boolean,
): LayerStep[] | 'rebuild' {
    const old = new Map(before.map((layer) => [layer.id, layer]));
    const kept = new Set(after.filter((layer) => old.has(layer.id)).map((layer) => layer.id));
    const stayedBefore = before.filter((layer) => kept.has(layer.id));
    const stayedAfter = after.filter((layer) => kept.has(layer.id));
    if (stayedBefore.some((layer, i) => layer.id !== stayedAfter[i].id)) {
        return 'rebuild';
    }
    const steps: LayerStep[] = [];
    for (const layer of before) {
        if (!kept.has(layer.id)) {
            if (hasElements(layer.id)) {
                return 'rebuild';
            }
            steps.push({ kind: 'remove', id: layer.id });
        }
    }
    let above: Id | null = null;
    for (let i = after.length - 1; i >= 0; i--) {
        const { id } = after[i];
        if (!kept.has(id)) {
            steps.push({ kind: 'add', id, belowId: above });
        }
        above = id;
    }
    for (const layer of stayedAfter) {
        const previous = old.get(layer.id)!;
        if (layer.visible !== previous.visible) {
            steps.push({ kind: 'show', id: layer.id, visible: layer.visible });
        }
        if (layer.color !== previous.color || layer.linetype !== previous.linetype || layer.transparency !== previous.transparency) {
            steps.push({ kind: 'restyle', id: layer.id });
        }
    }
    return steps;
}
