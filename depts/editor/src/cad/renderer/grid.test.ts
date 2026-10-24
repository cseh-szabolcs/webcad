import { describe, expect, it } from 'vitest';
import { gridLines, gridStep, parseGridSpacing, parseMajorEvery } from './grid';
import { Viewport } from './Viewport';

const GRID = { spacing: 10, majorEvery: 10 };

describe('gridStep', () => {
    it('shows the spacing while its lines are far enough apart', () => {
        expect(gridStep(1, GRID, 10)).toBe(10);
        expect(gridStep(50, GRID, 10)).toBe(10);
    });

    it('gets coarser by majorEvery when zoomed out', () => {
        expect(gridStep(0.99, GRID, 10)).toBe(100);
        expect(gridStep(0.1, GRID, 10)).toBe(100);
        expect(gridStep(0.05, GRID, 10)).toBe(1000);
        expect(gridStep(0.001, GRID, 10)).toBe(10000);
    });

    it('gets coarser by 2 when every line is a major line', () => {
        expect(gridStep(0.4, { spacing: 10, majorEvery: 1 }, 10)).toBe(40);
    });
});

describe('gridLines', () => {
    it('gives the visible lines in view px, aligned to the origin', () => {
        // 1 px per mm, model origin at view (5, 95): x from -5 to 95, y from -5 to 95
        const viewport = new Viewport(1, { x: 5, y: 95 });
        const { vertical, horizontal } = gridLines(viewport, { width: 100, height: 100 }, GRID, 10);
        expect(vertical.map((line) => line.at)).toEqual([5, 15, 25, 35, 45, 55, 65, 75, 85, 95]);
        // Y up: the model origin is at the bottom
        expect(horizontal.map((line) => line.at)).toEqual([95, 85, 75, 65, 55, 45, 35, 25, 15, 5]);
    });

    it('marks every majorEvery-th line as a major line, also left of and below the origin', () => {
        const viewport = new Viewport(1, { x: 150, y: 150 });
        const { vertical, horizontal } = gridLines(viewport, { width: 300, height: 300 }, GRID, 10);
        const majorX = vertical.filter((line) => line.major).map((line) => viewport.viewToModel({ x: line.at, y: 0 }).x);
        expect(majorX).toEqual([-100, 0, 100]);
        const majorY = horizontal.filter((line) => line.major).map((line) => viewport.viewToModel({ x: 0, y: line.at }).y);
        expect(majorY).toEqual([-100, 0, 100]);
        expect(vertical).toHaveLength(31);
    });

    it('turns the former major lines into minor ones when the grid gets coarser', () => {
        const viewport = new Viewport(0.1, { x: 0, y: 100 });
        const { vertical } = gridLines(viewport, { width: 100, height: 100 }, GRID, 10);
        // Step 100 mm = 10 px; x 0 … 1000 mm, the major lines every 1000 mm
        expect(vertical).toHaveLength(11);
        expect(vertical.filter((line) => line.major).map((line) => line.at)).toEqual([0, 100]);
    });

    it('has no lines for an unusable spacing or an empty view', () => {
        const viewport = new Viewport();
        expect(gridLines(viewport, { width: 100, height: 100 }, { spacing: 0, majorEvery: 10 }, 10)).toEqual({
            vertical: [],
            horizontal: [],
        });
        expect(gridLines(viewport, { width: 0, height: 100 }, GRID, 10).vertical).toEqual([]);
    });
});

describe('grid input', () => {
    it('parses a positive spacing with a decimal point', () => {
        expect(parseGridSpacing('10')).toBe(10);
        expect(parseGridSpacing(' 2.5 ')).toBe(2.5);
        expect(parseGridSpacing('.5')).toBe(0.5);
        expect(parseGridSpacing('0')).toBeNull();
        expect(parseGridSpacing('-10')).toBeNull();
        expect(parseGridSpacing('2,5')).toBeNull();
        expect(parseGridSpacing('')).toBeNull();
    });

    it('parses a whole number of lines per major line from 1 to 100', () => {
        expect(parseMajorEvery('5')).toBe(5);
        expect(parseMajorEvery('1')).toBe(1);
        expect(parseMajorEvery('100')).toBe(100);
        expect(parseMajorEvery('0')).toBeNull();
        expect(parseMajorEvery('101')).toBeNull();
        expect(parseMajorEvery('2.5')).toBeNull();
        expect(parseMajorEvery('')).toBeNull();
    });
});
