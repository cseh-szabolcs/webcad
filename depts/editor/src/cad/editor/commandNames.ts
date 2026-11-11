import { currentLanguage, t, type Language } from '../../i18n/i18n';
import aliases from './commandAliases.json';

/**
 * Commands of the editor, by their English AutoCAD name (the keys of commandAliases.json).
 * Its values are aliases the command line also takes, e.g. the German name; the first alias
 * is the name shown in German.
 */
export type EditorCommand = keyof typeof aliases;

const COMMAND_ALIASES: Readonly<Record<EditorCommand, readonly string[]>> = aliases;

export const EDITOR_COMMANDS = Object.keys(COMMAND_ALIASES) as EditorCommand[];

/** Command names and aliases in upper case; a name wins over an alias of another command. */
const LOOKUP: ReadonlyMap<string, EditorCommand> = new Map([
    ...EDITOR_COMMANDS.flatMap((command) => COMMAND_ALIASES[command].map((alias) => [alias.toUpperCase(), command] as const)),
    ...EDITOR_COMMANDS.map((command) => [command.toUpperCase(), command] as const),
]);

/** The command typed text names, by its name or an alias, in any case; null if none. */
export function findCommand(text: string): EditorCommand | null {
    return LOOKUP.get(text.trim().toUpperCase()) ?? null;
}

/** Name shown on the command line: the English name, in German its first alias. */
export function commandName(command: EditorCommand, language: Language = currentLanguage()): string {
    return language === 'de' ? (COMMAND_ALIASES[command][0] ?? command) : command;
}

/** Grip modes, which name an undo step like AutoCAD's GRIP_STRETCH but cannot be started by name. */
const GRIP_LABELS = {
    GRIP_STRETCH: 'gripMode.stretch',
    GRIP_MOVE: 'gripMode.move',
    GRIP_ROTATE: 'gripMode.rotate',
    GRIP_SCALE: 'gripMode.scale',
    GRIP_MIRROR: 'gripMode.mirror',
    GRIP_LENGTHEN: 'gripMode.lengthen',
    GRIP_RADIUS: 'gripMode.radius',
    GRIP_ADD_VERTEX: 'gripMode.addVertex',
    GRIP_REMOVE_VERTEX: 'gripMode.removeVertex',
} as const;

export type GripLabel = keyof typeof GRIP_LABELS;

/** What names an undo step: a command, or a grip mode. */
export type CommandLabel = EditorCommand | GripLabel;

/** Name of an undo step on the command line, in the current language. */
export function labelName(label: CommandLabel): string {
    return label in GRIP_LABELS ? t(GRIP_LABELS[label as GripLabel]) : commandName(label as EditorCommand);
}
