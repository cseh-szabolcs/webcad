import { describe, expect, it } from 'vitest';
import { DEFAULT_DYNAMIC_INPUT_SETTINGS } from '../../settings/editorSettings';
import {
    backspaceDynamic,
    dynamicFields,
    dynamicLayout,
    dynamicPoint,
    dynamicText,
    EMPTY_DYNAMIC_INPUT,
    focusNextField,
    formatDynamicAngle,
    formatLength,
    isBound,
    typeDynamic,
    typedValues,
    type DynamicContext,
    type DynamicInputState,
} from './dynamicInput';

const BASE_POINT: DynamicContext = { prompt: 'point', from: null, lastPoint: { x: 10, y: 20 }, trackOrigin: null };
const SECOND_POINT: DynamicContext = {
    prompt: 'next',
    from: { x: 100, y: 100 },
    lastPoint: { x: 100, y: 100 },
    trackOrigin: null,
};
const LENGTH: DynamicContext = { ...SECOND_POINT, prompt: 'distance' };

/** Types each character of `text` (Tab as `\t`). */
const typed = (text: string, state: DynamicInputState = EMPTY_DYNAMIC_INPUT) =>
    [...text].reduce((next, char) => (char === '\t' ? focusNextField(next) : typeDynamic(next, char)), state);

const closeTo = (actual: { x: number; y: number } | null, x: number, y: number) => {
    expect(actual).not.toBeNull();
    expect(actual!.x).toBeCloseTo(x);
    expect(actual!.y).toBeCloseTo(y);
};

describe('dynamicLayout', () => {
    it('shows the second point on a dimension, the others at the crosshair', () => {
        const settings = DEFAULT_DYNAMIC_INPUT_SETTINGS;
        expect(dynamicLayout(settings, 'point')).toBe('pointer');
        expect(dynamicLayout(settings, 'vector')).toBe('pointer');
        expect(dynamicLayout(settings, 'next')).toBe('dimension');
        expect(dynamicLayout({ ...settings, dimensionInput: false }, 'next')).toBe('pointer');
        expect(dynamicLayout(settings, 'distance')).toBe('dimension');
        expect(dynamicLayout({ ...settings, dimensionInput: false }, 'distance')).toBe('pointer');
    });

    it('shows nothing while off, and the first point only with pointer input', () => {
        const settings = DEFAULT_DYNAMIC_INPUT_SETTINGS;
        expect(dynamicLayout({ ...settings, enabled: false }, 'next')).toBeNull();
        expect(dynamicLayout({ ...settings, pointerInput: false }, 'point')).toBeNull();
        expect(dynamicLayout({ ...settings, pointerInput: false }, 'next')).toBe('dimension');
        expect(dynamicLayout({ ...settings, pointerInput: false, dimensionInput: false }, 'next')).toBeNull();
    });
});

describe('typing into the fields', () => {
    it('types into the first field; , and < move on to the second and choose the format', () => {
        expect(typed('12').fields).toEqual(['12', '']);
        const cartesian = typed('12,3');
        expect(cartesian).toMatchObject({ fields: ['12', '3'], focus: 1, format: 'cartesian' });
        expect(dynamicText(cartesian, SECOND_POINT)).toBe('12,3');
        const polar = typed('100<45', EMPTY_DYNAMIC_INPUT);
        expect(polar).toMatchObject({ fields: ['100', '45'], focus: 1, format: 'polar' });
        expect(dynamicText(polar, BASE_POINT)).toBe('100<45');
        // A second separator is just text in the second field
        expect(typed('1,2,3').fields).toEqual(['1', '2,3']);
    });

    it('switches fields with Tab; typing into a typed field replaces it', () => {
        const state = typed('100\t45');
        expect(state).toMatchObject({ fields: ['100', '45'], focus: 1 });
        // The prompt's own separator shows on the command line
        expect(dynamicText(state, SECOND_POINT)).toBe('100<45');
        expect(dynamicText(state, BASE_POINT)).toBe('100,45');
        const back = typed('\t7', state);
        expect(back).toMatchObject({ fields: ['7', '45'], focus: 0 });
    });

    it('deletes with Backspace and goes back to the first field from an empty second one', () => {
        let state = typed('12,3');
        state = backspaceDynamic(state);
        expect(state).toMatchObject({ fields: ['12', ''], focus: 1 });
        state = backspaceDynamic(state);
        expect(state).toMatchObject({ fields: ['12', ''], focus: 0, format: null });
        expect(backspaceDynamic(backspaceDynamic(backspaceDynamic(state)))).toEqual(EMPTY_DYNAMIC_INPUT);
        // After Tab back into a typed field, Backspace clears it at once
        expect(backspaceDynamic(typed('100\t45\t')).fields).toEqual(['', '45']);
    });

    it('reads numbers, and text such as an option keyword', () => {
        expect(typedValues(typed('#200,-3.5'))).toEqual([200, -3.5]);
        expect(typedValues(typed('@'))).toEqual([null, null]);
        expect(typedValues(typed('V'))).toBe('text');
        expect(typedValues(typed('1,x'))).toBe('text');
        expect(isBound(typed('\t45'))).toBe(true);
        expect(isBound(typed('#'))).toBe(false);
    });
});

describe('dynamicPoint', () => {
    it('binds nothing while no number is typed', () => {
        expect(dynamicPoint(EMPTY_DYNAMIC_INPUT, SECOND_POINT, { x: 1, y: 2 })).toBeNull();
        expect(dynamicPoint(typed('V'), BASE_POINT, { x: 1, y: 2 })).toBeNull();
    });

    it('takes X/Y absolute at the base point, the missing one from the point; @ relative to the last point', () => {
        expect(dynamicPoint(typed('30,40'), BASE_POINT, null)).toEqual({ x: 30, y: 40 });
        expect(dynamicPoint(typed('30'), BASE_POINT, { x: 5, y: 6 })).toEqual({ x: 30, y: 6 });
        expect(dynamicPoint(typed('\t40'), BASE_POINT, { x: 5, y: 6 })).toEqual({ x: 5, y: 40 });
        expect(dynamicPoint(typed('30'), BASE_POINT, null)).toBeNull();
        expect(dynamicPoint(typed('@30,40'), BASE_POINT, null)).toEqual({ x: 40, y: 60 });
    });

    it('measures distance and angle from the base point at the second point, # from the origin', () => {
        closeTo(dynamicPoint(typed('100<90'), SECOND_POINT, null), 100, 200);
        expect(dynamicPoint(typed('50,-20'), SECOND_POINT, null)).toEqual({ x: 150, y: 80 });
        expect(dynamicPoint(typed('#50,-20'), SECOND_POINT, null)).toEqual({ x: 50, y: -20 });
        closeTo(dynamicPoint(typed('#100<90'), SECOND_POINT, null), 0, 100);
    });

    it('goes a lone distance towards the point, from the tracking origin on a tracking path', () => {
        closeTo(dynamicPoint(typed('50'), SECOND_POINT, { x: 100, y: 400 }), 100, 150);
        expect(dynamicPoint(typed('50'), SECOND_POINT, null)).toBeNull();
        // Without a direction
        expect(dynamicPoint(typed('50'), SECOND_POINT, { x: 100, y: 100 })).toBeNull();
        const tracking = { ...SECOND_POINT, trackOrigin: { x: 0, y: 300 } };
        closeTo(dynamicPoint(typed('50'), tracking, { x: 200, y: 300 }), 50, 300);
    });

    it('goes along the ray of a lone angle as far as the point is from the base point', () => {
        closeTo(dynamicPoint(typed('<0'), SECOND_POINT, { x: 100, y: 300 }), 300, 100);
        // 200 below the base point, as in a quadrant snap, stays 200 at 12°
        const twelve = Math.PI / 15;
        closeTo(dynamicPoint(typed('<12'), SECOND_POINT, { x: 100, y: -100 }), 100 + 200 * Math.cos(twelve), 100 + 200 * Math.sin(twelve));
        // Never backwards, even with the point behind the ray's origin
        closeTo(dynamicPoint(typed('<90'), SECOND_POINT, { x: 100, y: 50 }), 100, 150);
        expect(dynamicPoint(typed('\t90'), SECOND_POINT, null)).toBeNull();
    });
});

describe('the distance alone at a distance prompt', () => {
    it('keeps , and < in the one field, so the text goes to the command line as a point', () => {
        const state = [...'@30,40'].reduce((next, char) => typeDynamic(next, char, true), EMPTY_DYNAMIC_INPUT);
        expect(state.fields).toEqual(['@30,40', '']);
        expect(typedValues(state)).toBe('text');
        expect(dynamicText(state, LENGTH)).toBe('@30,40');
    });

    it('goes the typed distance from the base point towards the point, always from there', () => {
        closeTo(dynamicPoint(typed('50'), LENGTH, { x: 100, y: 400 }), 100, 150);
        closeTo(dynamicPoint(typed('50'), { ...LENGTH, trackOrigin: { x: 0, y: 300 } }, { x: 200, y: 100 }), 150, 100);
        expect(dynamicPoint(typed('50'), LENGTH, null)).toBeNull();
    });

    it('shows one field with the live distance from the base point', () => {
        expect(dynamicFields(EMPTY_DYNAMIC_INPUT, LENGTH, { x: 130, y: 140 })).toEqual([
            { kind: 'distance', text: '50.00', typed: false, focused: true },
        ]);
        expect(dynamicFields(typed('12'), LENGTH, { x: 130, y: 140 })).toEqual([
            { kind: 'distance', text: '12', typed: true, focused: true },
        ]);
    });
});

describe('dynamicFields', () => {
    it('shows the live X/Y of the point, or distance and angle from the base point', () => {
        expect(dynamicFields(EMPTY_DYNAMIC_INPUT, BASE_POINT, { x: 12.345, y: -0.001 })).toEqual([
            { kind: 'x', text: '12.35', typed: false, focused: true },
            { kind: 'y', text: '0.00', typed: false, focused: false },
        ]);
        expect(dynamicFields(EMPTY_DYNAMIC_INPUT, SECOND_POINT, { x: 100, y: 0 })).toEqual([
            { kind: 'distance', text: '100.00', typed: false, focused: true },
            { kind: 'angle', text: '270', typed: false, focused: false },
        ]);
    });

    it('shows typed text as typed, the rest live; empty without a point', () => {
        const state = typed('#50,');
        expect(dynamicFields(state, SECOND_POINT, { x: 50, y: 7 })).toEqual([
            { kind: 'x', text: '#50', typed: true, focused: false },
            { kind: 'y', text: '7.00', typed: false, focused: true },
        ]);
        expect(dynamicFields(EMPTY_DYNAMIC_INPUT, BASE_POINT, null).map(({ text }) => text)).toEqual(['', '']);
    });
});

describe('formatting', () => {
    it('formats lengths with fixed decimals and angles in [0, 360) with few', () => {
        expect(formatLength(-0.004)).toBe('0.00');
        expect(formatLength(1234.5)).toBe('1234.50');
        expect(formatDynamicAngle(-90)).toBe('270');
        expect(formatDynamicAngle(359.999)).toBe('0');
        expect(formatDynamicAngle(22.5)).toBe('22.5');
        expect(formatDynamicAngle(37.28461)).toBe('37.28');
    });
});
