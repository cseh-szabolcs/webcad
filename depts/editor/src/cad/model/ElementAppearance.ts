import type { CadElement } from './CadElement';

/**
 * What an element is drawn with instead of its style's or its layer's value: its own colour
 * (`#rrggbb`), linetype, lineweight (1/100 mm) and transparency (percent); null where it
 * overrides nothing, like AutoCAD's ByLayer.
 */
export type ElementAppearance = Pick<CadElement, 'color' | 'linetype' | 'lineweight' | 'transparency'>;

export const APPEARANCE_KEYS = ['color', 'linetype', 'lineweight', 'transparency'] as const satisfies readonly (keyof ElementAppearance)[];

/** Overrides nothing: the element is drawn by its style, or by its layer. */
export const BY_LAYER: Readonly<ElementAppearance> = { color: null, linetype: null, lineweight: null, transparency: null };

/** What several elements override: per property their common value, or undefined where they differ. */
export type CommonAppearance = { [K in keyof ElementAppearance]: ElementAppearance[K] | undefined };

/** What all of `elements` override alike (see CommonAppearance); nothing for none. */
export function commonAppearance(elements: readonly ElementAppearance[]): CommonAppearance {
    const common = (key: keyof ElementAppearance) => {
        const first = elements[0]?.[key] ?? null;
        return elements.every((element) => element[key] === first) ? first : undefined;
    };
    return {
        color: common('color') as CommonAppearance['color'],
        linetype: common('linetype') as CommonAppearance['linetype'],
        lineweight: common('lineweight') as CommonAppearance['lineweight'],
        transparency: common('transparency') as CommonAppearance['transparency'],
    };
}
