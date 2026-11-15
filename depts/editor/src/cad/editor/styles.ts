import type { CadDocument } from '../model/CadDocument';
import type { Id } from '../model/Point';

/** Longest name of a style. */
export const MAX_STYLE_NAME_LENGTH = 255;

/** Why a style cannot have a name. */
export type StyleNameError = 'empty' | 'tooLong' | 'duplicate';

/**
 * What is wrong with `name` (as given, untrimmed) for a style, null if nothing: names are unique
 * within the plan whatever the case. `exceptId` is the style that gets the name.
 */
export function styleNameError(doc: CadDocument, name: string, exceptId: Id | null = null): StyleNameError | null {
    const trimmed = name.trim();
    if (trimmed === '') {
        return 'empty';
    }
    if (trimmed.length > MAX_STYLE_NAME_LENGTH) {
        return 'tooLong';
    }
    const lower = trimmed.toLowerCase();
    return doc.styles.some((style) => style.id !== exceptId && style.name.toLowerCase() === lower) ? 'duplicate' : null;
}

/** The first of `prefix1`, `prefix2`, … no style has. */
export function nextStyleName(doc: CadDocument, prefix: string): string {
    const taken = new Set(doc.styles.map((style) => style.name.toLowerCase()));
    let number = 1;
    while (taken.has(`${prefix}${number}`.toLowerCase())) {
        number++;
    }
    return `${prefix}${number}`;
}

/** How many elements have each style; a style without any is not in it. */
export function styleElementCounts(doc: CadDocument): Map<Id, number> {
    const counts = new Map<Id, number>();
    for (const { styleId } of doc.elements) {
        if (styleId !== null) {
            counts.set(styleId, (counts.get(styleId) ?? 0) + 1);
        }
    }
    return counts;
}
