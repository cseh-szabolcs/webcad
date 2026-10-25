import type { Point } from '../model/Point';

/**
 * A point typed on the command line, like AutoCAD:
 * - `x,y` (or `#x,y`) and `abstand<winkel` (or `#…`): absolute, from the origin;
 * - `@dx,dy` and `@abstand<winkel`: relative to a reference point; `@` alone is the reference itself;
 * - a plain number: a distance in the direction of the cursor (direct distance entry).
 *
 * The decimal separator is the point, the comma separates the coordinates (as in German
 * AutoCAD). Angles are degrees, counter-clockwise from +X in the model (Y up).
 */
export type PointInput =
    | { kind: 'absolute'; point: Point }
    | { kind: 'relative'; offset: Point }
    | { kind: 'distance'; distance: number };

const NUMBER = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)`;
const CARTESIAN = new RegExp(`^(${NUMBER}),(${NUMBER})$`);
const POLAR = new RegExp(`^(${NUMBER})<(${NUMBER})$`);
const DISTANCE = new RegExp(`^${NUMBER}$`);

/** A typed number (spaces ignored, `.` decimals), or null. */
export function parseNumber(text: string): number | null {
    const rest = text.replace(/\s+/g, '');
    return DISTANCE.test(rest) ? Number(rest) : null;
}

/** Parses typed text (spaces ignored) as a point, or returns null if it is none. */
export function parsePointInput(text: string): PointInput | null {
    let rest = text.replace(/\s+/g, '');
    const relative = rest.startsWith('@');
    if (relative || rest.startsWith('#')) {
        rest = rest.slice(1);
        if (relative && rest === '') {
            return { kind: 'relative', offset: { x: 0, y: 0 } };
        }
    } else if (DISTANCE.test(rest)) {
        return { kind: 'distance', distance: Number(rest) };
    }
    const vector = parseVector(rest);
    if (vector === null) {
        return null;
    }
    return relative ? { kind: 'relative', offset: vector } : { kind: 'absolute', point: vector };
}

/** `x,y` or `abstand<winkel` as a vector, or null. */
function parseVector(text: string): Point | null {
    const cartesian = CARTESIAN.exec(text);
    if (cartesian) {
        return { x: Number(cartesian[1]), y: Number(cartesian[2]) };
    }
    const polar = POLAR.exec(text);
    if (polar) {
        const distance = Number(polar[1]);
        const angle = (Number(polar[2]) * Math.PI) / 180;
        return { x: distance * Math.cos(angle), y: distance * Math.sin(angle) };
    }
    return null;
}

/**
 * The point a typed input stands for: relative inputs are offset from `reference`, a distance
 * goes from `reference` towards `toward`. Null for a distance without a direction (no cursor,
 * or the cursor on the reference point).
 */
export function resolvePointInput(input: PointInput, reference: Point, toward: Point | null): Point | null {
    switch (input.kind) {
        case 'absolute':
            return input.point;
        case 'relative':
            return { x: reference.x + input.offset.x, y: reference.y + input.offset.y };
        case 'distance': {
            if (toward === null) {
                return null;
            }
            const dx = toward.x - reference.x;
            const dy = toward.y - reference.y;
            const length = Math.hypot(dx, dy);
            if (length === 0) {
                return null;
            }
            const scale = input.distance / length;
            return { x: reference.x + dx * scale, y: reference.y + dy * scale };
        }
    }
}

/** Typed text chooses an option: a non-empty start of its keyword, in any case. */
export function matchesKeyword(text: string, keyword: string): boolean {
    const typed = text.trim().toLowerCase();
    return typed !== '' && keyword.toLowerCase().startsWith(typed);
}
