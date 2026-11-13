import { describe, expect, it } from 'vitest';
import { DEFAULT_EDITOR_SWITCHES, parseSwitches, serializeSwitches, type EditorSwitches } from './storedSwitches';

const CHANGED: EditorSwitches = {
    snap: { enabled: false, modes: new Set(['END', 'GCE']) },
    tracking: { ortho: false, polar: { enabled: true, incrementAngle: 15, additionalAngles: [33, 71.5] } },
    objectTracking: { enabled: true, allPolarAngles: true },
    grid: { enabled: false, spacing: 2.5, majorEvery: 4 },
    dynamicInput: { enabled: false, pointerInput: false, dimensionInput: true, prompts: false },
};

describe('stored switches', () => {
    it('come back as they were stored, the snap modes as a set', () => {
        expect(parseSwitches(serializeSwitches(CHANGED))).toEqual(CHANGED);
        expect(parseSwitches(serializeSwitches(DEFAULT_EDITOR_SWITCHES))).toEqual(DEFAULT_EDITOR_SWITCHES);
    });

    it('are the defaults without stored text or with text that is no JSON object', () => {
        for (const json of [null, '', '{', 'null', '[]', '"x"', '{"snap":3}']) {
            expect(parseSwitches(json)).toEqual(DEFAULT_EDITOR_SWITCHES);
        }
    });

    it('fall back per value where one is missing or not valid', () => {
        const parsed = parseSwitches(
            JSON.stringify({
                snap: { enabled: 'yes', modes: ['MID', 'NOPE'] },
                tracking: { polar: { incrementAngle: 7, additionalAngles: [1, 'x'] } },
                grid: { enabled: false, spacing: -1, majorEvery: 1000 },
                dynamicInput: { prompts: false },
            }),
        );
        expect(parsed.snap).toEqual({ enabled: true, modes: new Set(['MID']) });
        expect(parsed.tracking).toEqual(DEFAULT_EDITOR_SWITCHES.tracking);
        expect(parsed.grid).toEqual({ ...DEFAULT_EDITOR_SWITCHES.grid, enabled: false });
        expect(parsed.dynamicInput).toEqual({ ...DEFAULT_EDITOR_SWITCHES.dynamicInput, prompts: false });
        expect(parsed.objectTracking).toEqual(DEFAULT_EDITOR_SWITCHES.objectTracking);
    });

    it('never has Ortho and polar tracking on together', () => {
        const both = JSON.stringify({ tracking: { ortho: true, polar: { enabled: true, incrementAngle: 45 } } });
        expect(parseSwitches(both).tracking).toMatchObject({ ortho: true, polar: { enabled: false, incrementAngle: 45 } });
    });
});
