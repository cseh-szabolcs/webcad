import type { ParseKeys } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { commandName, type EditorCommand } from 'app/cad/editor/commandNames';
import type { ArcMethod } from 'app/cad/editor/tools/ArcTool';
import type { ToolId } from 'app/cad/editor/tools/EditorTool';
import { ToolIcon } from './ToolIcon';
import { useMenu } from './useMenu';

interface Tool {
    command: EditorCommand;
    /** The method of the command the button starts, where it has several. */
    method?: ArcMethod;
    label: ParseKeys;
    title: ParseKeys;
}

type ToolMethod = Tool & { method: ArcMethod };

/** Several ways to draw one kind of object behind one button, like AutoCAD's arc dropdown. */
interface ToolFlyoutSpec {
    label: ParseKeys;
    /** Names the button that opens the menu. */
    more: ParseKeys;
    methods: readonly [ToolMethod, ...ToolMethod[]];
}

const arcMethod = (method: ArcMethod, label: ParseKeys, title: ParseKeys): ToolMethod => ({ command: 'ARC', method, label, title });

/** The tool buttons, grouped like AutoCAD's Draw and Modify panels. */
const GROUPS = [
    {
        label: 'toolbar.draw',
        tools: [
            { command: 'LINE', label: 'toolbar.line', title: 'toolbar.lineTitle' },
            { command: 'PLINE', label: 'toolbar.polyline', title: 'toolbar.polylineTitle' },
            { command: 'CIRCLE', label: 'toolbar.circle', title: 'toolbar.circleTitle' },
            {
                label: 'toolbar.arc',
                more: 'toolbar.arcMore',
                methods: [
                    arcMethod('threePoints', 'toolbar.arcThreePoints', 'toolbar.arcThreePointsTitle'),
                    arcMethod('startCenterEnd', 'toolbar.arcStartCenterEnd', 'toolbar.arcStartCenterEndTitle'),
                    arcMethod('startCenterAngle', 'toolbar.arcStartCenterAngle', 'toolbar.arcStartCenterAngleTitle'),
                    arcMethod('startCenterLength', 'toolbar.arcStartCenterLength', 'toolbar.arcStartCenterLengthTitle'),
                    arcMethod('startEndAngle', 'toolbar.arcStartEndAngle', 'toolbar.arcStartEndAngleTitle'),
                    arcMethod('startEndDirection', 'toolbar.arcStartEndDirection', 'toolbar.arcStartEndDirectionTitle'),
                    arcMethod('startEndRadius', 'toolbar.arcStartEndRadius', 'toolbar.arcStartEndRadiusTitle'),
                    arcMethod('centerStartEnd', 'toolbar.arcCenterStartEnd', 'toolbar.arcCenterStartEndTitle'),
                    arcMethod('centerStartAngle', 'toolbar.arcCenterStartAngle', 'toolbar.arcCenterStartAngleTitle'),
                    arcMethod('centerStartLength', 'toolbar.arcCenterStartLength', 'toolbar.arcCenterStartLengthTitle'),
                    arcMethod('continue', 'toolbar.arcContinue', 'toolbar.arcContinueTitle'),
                ],
            },
            { command: 'ELLIPSE', label: 'toolbar.ellipse', title: 'toolbar.ellipseTitle' },
            { command: 'RECTANG', label: 'toolbar.rectangle', title: 'toolbar.rectangleTitle' },
        ],
    },
    { label: 'toolbar.modify', tools: [{ command: 'MOVE', label: 'toolbar.move', title: 'toolbar.moveTitle' }] },
] as const satisfies readonly { label: ParseKeys; tools: readonly (Tool | ToolFlyoutSpec)[] }[];

interface ToolPanelProps {
    /** The running command, whose button shows pressed; the editing of a grip has none. */
    command: ToolId | null;
    onStart: (command: EditorCommand, method?: ArcMethod) => void;
}

/** Horizontal tool bar above the drawing: one icon button per command, its name in the tooltip. */
export function ToolPanel({ command, onStart }: ToolPanelProps) {
    const { t } = useTranslation();
    return (
        <div className="tool-panel" role="toolbar" aria-label={t('toolbar.tools')}>
            {GROUPS.map((group) => (
                <div key={group.label} className="tool-panel-group" role="group" aria-label={t(group.label)}>
                    {group.tools.map((tool) =>
                        'methods' in tool ? (
                            <ToolFlyout key={tool.label} flyout={tool} command={command} onStart={onStart} />
                        ) : (
                            <ToolButton key={tool.command} tool={tool} command={command} onStart={onStart} />
                        ),
                    )}
                </div>
            ))}
        </div>
    );
}

function ToolButton({ tool, command, onStart }: ToolPanelProps & { tool: Tool }) {
    const { t } = useTranslation();
    const title = t(tool.title, { command: commandName(tool.command) });
    return (
        <button
            type="button"
            className="tool-button"
            aria-pressed={command === tool.command}
            aria-label={title}
            title={title}
            onClick={() => onStart(tool.command, tool.method)}
        >
            <ToolIcon command={tool.command} method={tool.method} />
        </button>
    );
}

/**
 * A tool button for the method used last (the first one to begin with), and beside it a narrow
 * button that opens the menu of all methods; choosing one starts it and puts it on the button.
 */
function ToolFlyout({ flyout, command, onStart }: ToolPanelProps & { flyout: ToolFlyoutSpec }) {
    const { t } = useTranslation();
    const { open, setOpen, rootRef } = useMenu();
    const [usedMethod, setUsedMethod] = useState(flyout.methods[0].method);
    const used = flyout.methods.find((tool) => tool.method === usedMethod) ?? flyout.methods[0];

    return (
        <div className="tool-flyout" ref={rootRef}>
            <ToolButton tool={used} command={command} onStart={onStart} />
            <button
                type="button"
                className="tool-flyout-expand"
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label={t(flyout.more)}
                title={t(flyout.more)}
                onClick={() => setOpen(!open)}
            >
                <span aria-hidden="true">▾</span>
            </button>
            {open && (
                <div className="tool-menu" role="menu" aria-label={t(flyout.label)}>
                    {flyout.methods.map((tool) => (
                        <button
                            key={tool.method}
                            type="button"
                            role="menuitemradio"
                            aria-checked={tool === used}
                            title={t(tool.title, { command: commandName(tool.command) })}
                            onClick={() => {
                                setUsedMethod(tool.method);
                                setOpen(false);
                                onStart(tool.command, tool.method);
                            }}
                        >
                            <ToolIcon command={tool.command} method={tool.method} />
                            {t(tool.label)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
