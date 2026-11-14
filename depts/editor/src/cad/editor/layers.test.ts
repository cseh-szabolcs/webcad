import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../model/CadDocument';
import { newLayer, type Layer } from '../model/Layer';
import { floorLayers, resolveCurrentLayer } from './layers';

function doc(...layers: Layer[]): CadDocument {
    return {
        id: 'plan',
        name: 'Plan',
        schemaVersion: 1,
        unit: 'mm',
        vertices: [],
        elements: [],
        floors: [
            { id: 'ground', name: 'Ground floor' },
            { id: 'upper', name: 'Upper floor' },
        ],
        layers,
        groups: [],
        styles: [],
    };
}

const zero = newLayer('zero', 'ground', '0');
const walls = newLayer('walls', 'ground', 'Walls');
const upperZero = newLayer('upper-zero', 'upper', '0');
const hidden = (layer: Layer): Layer => ({ ...layer, visible: false });

describe('floorLayers', () => {
    it('gives the layers of the floor in drawing order', () => {
        expect(floorLayers(doc(walls, upperZero, zero), 'ground')).toEqual([walls, zero]);
    });
});

describe('resolveCurrentLayer', () => {
    it('keeps a shown layer of the floor', () => {
        expect(resolveCurrentLayer(doc(zero, walls, upperZero), 'ground', 'walls')).toBe('walls');
    });

    it('starts with layer 0', () => {
        expect(resolveCurrentLayer(doc(walls, zero, upperZero), 'ground', null)).toBe('zero');
    });

    it('goes back to layer 0 when the layer is gone, hidden or on another floor', () => {
        expect(resolveCurrentLayer(doc(zero, upperZero), 'ground', 'walls')).toBe('zero');
        expect(resolveCurrentLayer(doc(zero, hidden(walls), upperZero), 'ground', 'walls')).toBe('zero');
        expect(resolveCurrentLayer(doc(zero, walls, upperZero), 'ground', 'upper-zero')).toBe('zero');
    });

    it('takes the first shown layer while layer 0 is hidden', () => {
        expect(resolveCurrentLayer(doc(hidden(zero), walls), 'ground', null)).toBe('walls');
    });

    it('takes layer 0 on a floor that shows nothing', () => {
        expect(resolveCurrentLayer(doc(hidden(walls), hidden(zero)), 'ground', 'walls')).toBe('zero');
    });

    it('has none on a floor without layers', () => {
        expect(resolveCurrentLayer(doc(upperZero), 'ground', null)).toBeNull();
    });
});
