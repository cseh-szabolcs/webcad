import { describe, expect, it } from 'vitest';
import { SNAP_MODE_LABELS, SNAP_MODE_RANK, SNAP_MODES } from './SnapMode';

describe('SnapMode', () => {
    it('ranks END > INT > CEN > MID > QUA > GCE', () => {
        expect([...SNAP_MODES].sort((a, b) => SNAP_MODE_RANK[a] - SNAP_MODE_RANK[b])).toEqual([
            'END',
            'INT',
            'CEN',
            'MID',
            'QUA',
            'GCE',
        ]);
    });

    it('lists the geometric centre after the centre, like AutoCAD', () => {
        expect(SNAP_MODES).toEqual(['END', 'MID', 'CEN', 'GCE', 'QUA', 'INT']);
        expect(SNAP_MODE_LABELS.GCE).toBe('Geometrisches Zentrum');
    });
});
