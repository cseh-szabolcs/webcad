import { describe, expect, it } from 'vitest';
import { DEFAULT_EDITOR_SETTINGS, DEFAULT_SNAP_SETTINGS, DEFAULT_TRACKING_MODES, layerPanelWidth, toggleLayerTab, withOrtho, withPolar } from './editorSettings';

describe('Ortho and polar tracking', () => {
    it('switches polar tracking off when Ortho goes on, keeping its angles', () => {
        const polar = { enabled: true, incrementAngle: 45, additionalAngles: [30] };
        expect(withOrtho({ ortho: false, polar }, true)).toEqual({ ortho: true, polar: { ...polar, enabled: false } });
    });

    it('leaves polar tracking off when Ortho goes off', () => {
        const modes = withOrtho(DEFAULT_TRACKING_MODES, true);
        expect(withOrtho(modes, false)).toEqual({ ortho: false, polar: modes.polar });
    });

    it('switches Ortho off when polar tracking goes on, but not for other changes', () => {
        const modes = withOrtho(DEFAULT_TRACKING_MODES, true);
        expect(withPolar(modes, { ...modes.polar, incrementAngle: 30 }).ortho).toBe(true);
        expect(withPolar(modes, { ...modes.polar, enabled: true })).toEqual({
            ortho: false,
            polar: { ...modes.polar, enabled: true },
        });
    });
});

describe('Running object snaps', () => {
    it('start with every mode but the geometric centre, like AutoCAD', () => {
        expect([...DEFAULT_SNAP_SETTINGS.modes]).toEqual(['END', 'MID', 'CEN', 'QUA', 'INT']);
    });
});

describe('Layer panel width', () => {
    const limits = { layerPanelWidth: 280, layerPanelMinWidth: 220, layerPanelMaxWidth: 520 };

    it('is the setting until the panel was dragged', () => {
        expect(layerPanelWidth({ open: true, width: null, tab: 'layers' }, limits)).toBe(280);
        expect(layerPanelWidth({ open: true, width: 400, tab: 'layers' }, limits)).toBe(400);
    });

    it('stays within the limits of the settings', () => {
        expect(layerPanelWidth({ open: true, width: 100, tab: 'layers' }, limits)).toBe(220);
        expect(layerPanelWidth({ open: true, width: 9000, tab: 'layers' }, limits)).toBe(520);
    });

    it('has a default between its limits', () => {
        const { layerPanelWidth: width, layerPanelMinWidth: min, layerPanelMaxWidth: max } = DEFAULT_EDITOR_SETTINGS;
        expect(min).toBeLessThanOrEqual(width);
        expect(width).toBeLessThanOrEqual(max);
    });
});

describe('Layer button', () => {
    it('opens the panel on its layer tab and closes it only from there', () => {
        expect(toggleLayerTab({ open: false, width: 300, tab: 'styles' })).toEqual({ open: true, width: 300, tab: 'layers' });
        expect(toggleLayerTab({ open: true, width: 300, tab: 'styles' })).toEqual({ open: true, width: 300, tab: 'layers' });
        expect(toggleLayerTab({ open: true, width: 300, tab: 'layers' })).toEqual({ open: false, width: 300, tab: 'layers' });
    });
});
