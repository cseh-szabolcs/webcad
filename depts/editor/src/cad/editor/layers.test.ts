import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../model/CadDocument';
import { newLayer, type Layer } from '../model/Layer';
import { floorLayers, layerElementCounts, layerNameError, nextLayerName, removeLayerBlocker, resolveCurrentLayer } from './layers';

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

describe('layerNameError', () => {
    const plan = doc(zero, walls, upperZero);

    it('takes a name no layer of the floor has', () => {
        expect(layerNameError(plan, 'ground', 'Doors & windows')).toBeNull();
        expect(layerNameError(plan, 'upper', 'Walls')).toBeNull();
    });

    it('refuses an empty one, also of blanks only', () => {
        expect(layerNameError(plan, 'ground', '')).toBe('empty');
        expect(layerNameError(plan, 'ground', '   ')).toBe('empty');
    });

    it('refuses one that is too long', () => {
        expect(layerNameError(plan, 'ground', 'x'.repeat(255))).toBeNull();
        expect(layerNameError(plan, 'ground', 'x'.repeat(256))).toBe('tooLong');
    });

    it.each(['<', '>', '/', '\\', '"', ':', ';', '?', '*', '|', ',', '=', '`'])('refuses the character %s', (character) => {
        expect(layerNameError(plan, 'ground', `a${character}b`)).toBe('invalidCharacters');
    });

    it('refuses the name of another layer of the floor, whatever the case and the blanks around it', () => {
        expect(layerNameError(plan, 'ground', ' WALLS ')).toBe('duplicate');
        expect(layerNameError(plan, 'ground', '0')).toBe('duplicate');
    });

    it('lets a layer keep its own name', () => {
        expect(layerNameError(plan, 'ground', 'walls', 'walls')).toBeNull();
    });
});

describe('nextLayerName', () => {
    it('counts up to the first name that is free on the floor', () => {
        const layer2 = newLayer('two', 'ground', 'layer2');
        expect(nextLayerName(doc(zero), 'ground', 'Layer')).toBe('Layer1');
        expect(nextLayerName(doc(zero, newLayer('one', 'ground', 'Layer1'), layer2), 'ground', 'Layer')).toBe('Layer3');
        expect(nextLayerName(doc(zero, newLayer('one', 'ground', 'Layer1'), upperZero), 'upper', 'Layer')).toBe('Layer1');
    });
});

describe('layers and their elements', () => {
    const line = (id: string, layerId: string) =>
        ({ id, type: 'line', name: null, layerId, groupId: null, styleId: null, startVertexId: 'a', endVertexId: 'b' }) as const;
    const plan = { ...doc(zero, walls, newLayer('empty', 'ground', 'Empty')), elements: [line('1', 'walls'), line('2', 'walls'), line('3', 'zero')] };

    it('counts the elements per layer', () => {
        expect([...layerElementCounts(plan)]).toEqual([
            ['walls', 2],
            ['zero', 1],
        ]);
    });

    it('keeps layer 0, the current layer and layers with elements from being removed', () => {
        expect(removeLayerBlocker(plan, 'zero', 'walls')).toBe('default');
        expect(removeLayerBlocker(plan, 'empty', 'empty')).toBe('current');
        expect(removeLayerBlocker(plan, 'walls', 'zero')).toBe('notEmpty');
        expect(removeLayerBlocker(plan, 'empty', 'zero')).toBeNull();
        expect(removeLayerBlocker(plan, 'gone', 'zero')).toBe('default');
    });
});
