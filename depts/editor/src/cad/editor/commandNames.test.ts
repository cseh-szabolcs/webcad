import { describe, expect, it } from 'vitest';
import aliases from './commandAliases.json';
import { commandName, EDITOR_COMMANDS, findCommand } from './commandNames';

describe('commandNames', () => {
    it('finds a command by its name or an alias, in any case and with spaces around', () => {
        expect(findCommand('MOVE')).toBe('MOVE');
        expect(findCommand(' schieben ')).toBe('MOVE');
        expect(findCommand('Move')).toBe('MOVE');
        expect(findCommand('SCHIEB')).toBeNull();
        expect(findCommand('')).toBeNull();
        expect(findCommand('l')).toBe('LINE');
        expect(findCommand('Linie')).toBe('LINE');
        expect(findCommand('pl')).toBe('PLINE');
        expect(findCommand('PLinie')).toBe('PLINE');
        expect(findCommand('k')).toBe('CIRCLE');
        expect(findCommand('c')).toBe('CIRCLE');
        expect(findCommand('el')).toBe('ELLIPSE');
        expect(findCommand('rec')).toBe('RECTANG');
        expect(findCommand('Rechteck')).toBe('RECTANG');
    });

    it('shows the English name, in German the first alias', () => {
        expect(commandName('MOVE', 'en')).toBe('MOVE');
        expect(commandName('MOVE', 'de')).toBe('SCHIEBEN');
        expect(commandName('LINE', 'de')).toBe('LINIE');
        expect(commandName('PLINE', 'de')).toBe('PLINIE');
        expect(commandName('PLINE', 'en')).toBe('PLINE');
        expect(commandName('CIRCLE', 'de')).toBe('KREIS');
        expect(commandName('ELLIPSE', 'de')).toBe('ELLIPSE');
        expect(commandName('RECTANG', 'de')).toBe('RECHTECK');
    });

    it('has upper case English names and aliases, none of them twice', () => {
        // A German name may be the English one (ELLIPSE), so a command's own name counts once
        const names = EDITOR_COMMANDS.flatMap((command) => [
            ...new Set([command, ...(aliases as Record<string, string[]>)[command]]),
        ]);
        expect(names.every((name) => /^[A-Z][A-Z0-9_]*$/.test(name)), names.join()).toBe(true);
        expect(new Set(names).size).toBe(names.length);
    });
});
