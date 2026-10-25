import type { Point } from '../model/Point';
import type { DynamicInputSettings } from '../../settings/editorSettings';
import { parseNumber, resolvePointInput } from './commandInput';
import type { PointPromptKind } from './tools/EditorTool';

/** Decimals of the live lengths and coordinates in the fields. */
export const DYN_LENGTH_DECIMALS = 2;
/** Most decimals of the live angle in the field (trailing zeros dropped). */
export const DYN_ANGLE_DECIMALS = 2;

/**
 * Two fields: X and Y, or distance and angle (degrees, counter-clockwise from +X); or, at a
 * `distance` prompt, the distance field alone.
 */
export type DynamicFormat = 'cartesian' | 'polar' | 'distance';
export type DynamicFieldKind = 'x' | 'y' | 'distance' | 'angle';
/** Fields at the crosshair, or on a temporary dimension from the prompt's `from` point. */
export type DynamicLayout = 'pointer' | 'dimension';

/**
 * Text typed into the two Dynamic Input fields at a point prompt, like AutoCAD (only the first at
 * a `distance` prompt). Field 0 may start with `#` (absolute) or `@` (relative). Replaced, never
 * mutated.
 */
export interface DynamicInputState {
    fields: readonly [string, string];
    focus: 0 | 1;
    /** Format chosen by a typed `,` or `<`, or null for the prompt's default. */
    format: DynamicFormat | null;
    /** The next typed character replaces the focused field (after Tab back into a typed one). */
    replace: boolean;
}

export const EMPTY_DYNAMIC_INPUT: DynamicInputState = { fields: ['', ''], focus: 0, format: null, replace: false };

/** Where the fields measure from. */
export interface DynamicContext {
    prompt: PointPromptKind;
    /** The point a `next` or `distance` prompt measures from. */
    from: Point | null;
    /** Last point given (AutoCAD's LASTPOINT), the reference of `@` at a `point` prompt. */
    lastPoint: Point;
    /** Origin of a single object snap tracking path the point lies on: a lone distance goes from there. */
    trackOrigin: Point | null;
}

/** What a field shows: the typed text, or the live value of the point a click would take. */
export interface DynamicField {
    kind: DynamicFieldKind;
    text: string;
    typed: boolean;
    focused: boolean;
}

const ORIGIN: Point = { x: 0, y: 0 };

/**
 * Which fields the prompt shows: a `point` (and a `vector`) only with pointer input, a `next`
 * point or a `distance` on a dimension with dimension input, else at the crosshair; null for
 * none, in which case typing goes to the command line as usual.
 */
export function dynamicLayout(settings: DynamicInputSettings, prompt: PointPromptKind): DynamicLayout | null {
    if (!settings.enabled) {
        return null;
    }
    if ((prompt === 'next' || prompt === 'distance') && settings.dimensionInput) {
        return 'dimension';
    }
    return settings.pointerInput ? 'pointer' : null;
}

export function isEmptyDynamicInput(state: DynamicInputState): boolean {
    return state.fields[0] === '' && state.fields[1] === '';
}

/** The distance alone at a `distance` prompt; polar at a `next` prompt, else X/Y; a typed `,` or `<` chooses. */
export function dynamicFormat(state: DynamicInputState, ctx: DynamicContext): DynamicFormat {
    if (ctx.prompt === 'distance') {
        return 'distance';
    }
    return state.format ?? (ctx.prompt === 'next' ? 'polar' : 'cartesian');
}

/** Relative to `from` at a `next` prompt unless `#`, at a `distance` prompt always; elsewhere only with `@`. */
export function isRelative(state: DynamicInputState, ctx: DynamicContext): boolean {
    const prefix = state.fields[0][0];
    return prefix === '@' || ctx.prompt === 'distance' || (ctx.prompt === 'next' && prefix !== '#');
}

/** The point the values are measured from. */
export function dynamicReference(state: DynamicInputState, ctx: DynamicContext): Point {
    if (!isRelative(state, ctx)) {
        return ORIGIN;
    }
    if (ctx.prompt === 'next' || ctx.prompt === 'distance') {
        return ctx.from ?? ORIGIN;
    }
    // A displacement is a vector either way
    return ctx.prompt === 'point' ? ctx.lastPoint : ORIGIN;
}

/**
 * A typed character: `,` or `<` in the first field chooses the format and moves to the second
 * field (not with `oneField`, at a `distance` prompt, where they stay in the field and so make
 * it a point for the command line); anything else goes into the focused field (replacing it
 * after Tab back into it).
 */
export function typeDynamic(state: DynamicInputState, char: string, oneField = false): DynamicInputState {
    if (!oneField && state.focus === 0 && (char === ',' || char === '<')) {
        return { ...state, focus: 1, format: char === ',' ? 'cartesian' : 'polar', replace: state.fields[1] !== '' };
    }
    const current = state.replace ? '' : state.fields[state.focus];
    return { ...state, fields: withField(state.fields, state.focus, current + char), replace: false };
}

/** Deletes the last character of the focused field; in an empty second field goes back to the first. */
export function backspaceDynamic(state: DynamicInputState): DynamicInputState {
    const text = state.fields[state.focus];
    if (state.replace || text !== '') {
        const next = state.replace ? '' : text.slice(0, -1);
        return { ...state, fields: withField(state.fields, state.focus, next), replace: false };
    }
    if (state.focus === 1) {
        return { ...state, focus: 0, format: null, replace: false };
    }
    return state;
}

/** Tab: to the other field; a typed value there is replaced by the next typed character. */
export function focusNextField(state: DynamicInputState): DynamicInputState {
    const focus = state.focus === 0 ? 1 : 0;
    return { ...state, focus, replace: state.fields[focus] !== '' };
}

/** The typed text as the command line shows it, e.g. `100<45` or `#200,300`. */
export function dynamicText(state: DynamicInputState, ctx: DynamicContext): string {
    const [first, second] = state.fields;
    if ((state.focus === 0 && second === '') || dynamicFormat(state, ctx) === 'distance') {
        return first;
    }
    return first + (dynamicFormat(state, ctx) === 'polar' ? '<' : ',') + second;
}

/**
 * The typed numbers, or null where a field is empty; 'text' where a field holds something else
 * (an option keyword or an invalid entry, for the command line's own parsing).
 */
export function typedValues(state: DynamicInputState): readonly [number | null, number | null] | 'text' {
    const texts = [state.fields[0].replace(/^[#@]/, ''), state.fields[1]].map((text) => text.trim());
    const values = texts.map((text) => (text === '' ? null : parseNumber(text)));
    if (values.some((value, i) => value === null && texts[i] !== '')) {
        return 'text';
    }
    return [values[0], values[1]];
}

/** Some field holds a number, so it binds the point. */
export function isBound(state: DynamicInputState): boolean {
    const values = typedValues(state);
    return values !== 'text' && (values[0] !== null || values[1] !== null);
}

/**
 * The point the typed values give, with the untyped ones taken from `point` (the point a click
 * would take otherwise): X/Y each typed or from the point; distance and angle both typed is a
 * fixed point; an angle alone goes along its ray as far as the point is from the reference; a
 * distance alone goes that far
 * towards the point (from the tracking origin on a single tracking path), like direct distance
 * entry, and so does the distance at a `distance` prompt, always from `from`. Null where nothing
 * binds or the point is needed but missing.
 */
export function dynamicPoint(state: DynamicInputState, ctx: DynamicContext, point: Point | null): Point | null {
    const values = typedValues(state);
    if (values === 'text') {
        return null;
    }
    const [first, second] = values;
    if (first === null && second === null) {
        return null;
    }
    const ref = dynamicReference(state, ctx);
    const format = dynamicFormat(state, ctx);
    if (format === 'distance') {
        return first === null ? null : point && resolvePointInput({ kind: 'distance', distance: first }, ref, point);
    }
    if (format === 'cartesian') {
        if ((first === null || second === null) && point === null) {
            return null;
        }
        return { x: ref.x + (first ?? point!.x - ref.x), y: ref.y + (second ?? point!.y - ref.y) };
    }
    if (second === null) {
        return point && resolvePointInput({ kind: 'distance', distance: first! }, ctx.trackOrigin ?? ref, point);
    }
    const angle = (second * Math.PI) / 180;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    if (first !== null) {
        return { x: ref.x + first * ux, y: ref.y + first * uy };
    }
    if (point === null) {
        return null;
    }
    // Always along the typed direction, as far as the point is from the reference
    const distance = Math.hypot(point.x - ref.x, point.y - ref.y);
    return { x: ref.x + distance * ux, y: ref.y + distance * uy };
}

/**
 * The fields (both, or the distance alone at a `distance` prompt): the typed text, else the live
 * value of `shown` (the bound point, or the point a click would take) measured from the
 * reference; empty without a point.
 */
export function dynamicFields(
    state: DynamicInputState,
    ctx: DynamicContext,
    shown: Point | null,
): readonly DynamicField[] {
    const format = dynamicFormat(state, ctx);
    const polar = format !== 'cartesian';
    const ref = dynamicReference(state, ctx);
    let live: readonly [string, string] = ['', ''];
    if (shown !== null) {
        const dx = shown.x - ref.x;
        const dy = shown.y - ref.y;
        live = polar
            ? [formatLength(Math.hypot(dx, dy)), formatDynamicAngle((Math.atan2(dy, dx) * 180) / Math.PI)]
            : [formatLength(dx), formatLength(dy)];
    }
    const kinds: readonly [DynamicFieldKind, DynamicFieldKind] = polar ? ['distance', 'angle'] : ['x', 'y'];
    const field = (i: 0 | 1): DynamicField => {
        const typed = state.fields[i] !== '';
        return { kind: kinds[i], text: typed ? state.fields[i] : live[i], typed, focused: state.focus === i };
    };
    return format === 'distance' ? [field(0)] : [field(0), field(1)];
}

/** A length with DYN_LENGTH_DECIMALS decimals, without a negative zero. */
export function formatLength(value: number): string {
    return (Number(value.toFixed(DYN_LENGTH_DECIMALS)) + 0).toFixed(DYN_LENGTH_DECIMALS);
}

/** An angle in [0, 360) with at most DYN_ANGLE_DECIMALS decimals. */
export function formatDynamicAngle(degrees: number): string {
    let angle = Number((((degrees % 360) + 360) % 360).toFixed(DYN_ANGLE_DECIMALS));
    if (angle >= 360) {
        angle -= 360;
    }
    return String(angle + 0);
}

function withField(fields: readonly [string, string], index: 0 | 1, text: string): readonly [string, string] {
    return index === 0 ? [text, fields[1]] : [fields[0], text];
}
