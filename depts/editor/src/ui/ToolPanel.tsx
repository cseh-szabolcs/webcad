import { useTranslation } from 'react-i18next';
import { commandName, type EditorCommand } from 'app/cad/editor/commandNames';
import { ToolIcon } from './ToolIcon';

/** The tool buttons, grouped like AutoCAD's Draw and Modify panels. */
const GROUPS = [
    { label: 'toolbar.draw', tools: [{ command: 'LINE', label: 'toolbar.line', title: 'toolbar.lineTitle' }] },
    { label: 'toolbar.modify', tools: [{ command: 'MOVE', label: 'toolbar.move', title: 'toolbar.moveTitle' }] },
] as const satisfies readonly {
    label: string;
    tools: readonly { command: EditorCommand; label: string; title: string }[];
}[];

interface ToolPanelProps {
    /** The running command, whose button shows pressed. */
    command: EditorCommand | null;
    onStart: (command: EditorCommand) => void;
}

/** Vertical tool bar on the left: one icon button per command, its name in the tooltip. */
export function ToolPanel({ command, onStart }: ToolPanelProps) {
    const { t } = useTranslation();
    return (
        <div className="tool-panel" role="toolbar" aria-orientation="vertical" aria-label={t('toolbar.tools')}>
            {GROUPS.map((group) => (
                <div key={group.label} className="tool-panel-group" role="group" aria-label={t(group.label)}>
                    {group.tools.map((tool) => {
                        const title = t(tool.title, { command: commandName(tool.command) });
                        return (
                            <button
                                key={tool.command}
                                type="button"
                                aria-pressed={command === tool.command}
                                aria-label={title}
                                title={title}
                                onClick={() => onStart(tool.command)}
                            >
                                <ToolIcon command={tool.command} />
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
