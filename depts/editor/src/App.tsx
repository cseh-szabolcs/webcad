import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DocumentHistory } from 'app/cad/editor/commands/DocumentHistory';
import type { SelectionSnapshot } from 'app/cad/editor/SelectionEditor';
import type { CadDocument } from 'app/cad/model/CadDocument';
import { currentLanguage, LANGUAGES, setLanguage } from 'app/i18n/i18n';
import type { Point } from 'app/cad/model/Point';
import { CadApiClient } from 'app/cad/persistence/CadApiClient';
import { backendHost, exitUrl } from 'app/backendHost';
import { useCollaboration } from 'app/collaboration/useCollaboration';
import {
    DEFAULT_EDITOR_SETTINGS,
    type DynamicInputSettings,
    type GridSettings,
    type LayerPanelState,
    layerPanelWidth,
    toggleLayerTab,
    type ObjectTrackingSettings,
    type SnapSettings,
    type TrackingModes,
    withOrtho,
    withPolar,
} from 'app/settings/editorSettings';
import { loadSwitches, saveSwitches } from 'app/settings/storedSwitches';
import type { Viewport } from 'app/cad/renderer/Viewport';
import { CadCanvas, type CadCanvasHandle } from 'app/ui/CadCanvas';
import { CollaborationStatus } from 'app/ui/CollaborationStatus';
import { CommandLine } from 'app/ui/CommandLine';
import { FullscreenIcon } from 'app/ui/FullscreenIcon';
import { useFullscreen } from 'app/ui/fullscreen';
import { LayerPanel } from 'app/ui/LayerPanel';
import { SidePanel } from 'app/ui/SidePanel';
import { StylePanel } from 'app/ui/StylePanel';
import { StatusBar } from 'app/ui/StatusBar';
import { ThemeIcon } from 'app/ui/ThemeIcon';
import { ToolbarSelect } from 'app/ui/ToolbarSelect';
import { ToolPanel } from 'app/ui/ToolPanel';
import { useTheme, type ThemePreference } from 'app/ui/theme';
import './App.css';

/**
 * Plan loaded in dev when no ?plan= is given; `bin/console app:fixture:create` resets the
 * database and creates it (`FixtureCreateCommand::DEV_PLAN_ID` in the backend).
 */
const DEV_PLAN_ID = '01994f4e-6f3a-7c2d-9b1e-5a3c2d1e0f42';

const api = new CadApiClient(`${backendHost()}/api`);

const NO_SELECTION: ReadonlySet<string> = new Set();

const THEME_OPTIONS = [
    { value: 'light', label: 'toolbar.themeLight', title: 'toolbar.themeLightTitle' },
    { value: 'dark', label: 'toolbar.themeDark', title: 'toolbar.themeDarkTitle' },
    { value: 'system', label: 'toolbar.themeSystem', title: 'toolbar.themeSystemTitle' },
] as const satisfies readonly { value: ThemePreference; label: string; title: string }[];

type LoadState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'loaded'; document: CadDocument };

function App() {
    const { t } = useTranslation();
    const language = currentLanguage();
    const query = new URLSearchParams(window.location.search);
    // The Symfony page (EditorController) names the plan on #root, Vite dev takes `?plan=`
    const planId = document.getElementById('root')?.dataset.planId ?? query.get('plan') ?? (import.meta.env.DEV ? DEV_PLAN_ID : null);
    // Dev only: `?stress=<count>` shows a generated plan of that many elements instead (see stressPlan)
    const stressCount = import.meta.env.DEV ? Number(query.get('stress')) || 0 : 0;
    const canvasRef = useRef<CadCanvasHandle>(null);
    const [viewport, setViewport] = useState<Viewport | null>(null);
    const [pointer, setPointer] = useState<Point | null>(null);
    const [selection, setSelection] = useState<SelectionSnapshot | null>(null);
    const [state, setState] = useState<LoadState>({ status: 'loading' });
    // The loaded document with its changes: the canvas edits it, the layer panel shows its layers
    const history = useMemo(() => (state.status === 'loaded' ? new DocumentHistory(state.document) : null), [state]);
    // Joined once the plan is shown; a generated stress plan belongs to no project
    const { state: collaboration, presence } = useCollaboration(api, state.status === 'loaded' && stressCount === 0 ? planId : null);
    // The switches of the status bar start as they were left in this browser
    const [stored] = useState(loadSwitches);
    const [snapSettings, setSnapSettings] = useState<SnapSettings>(stored.snap);
    const [tracking, setTracking] = useState<TrackingModes>(stored.tracking);
    const [objectTracking, setObjectTracking] = useState<ObjectTrackingSettings>(stored.objectTracking);
    const [gridSettings, setGridSettings] = useState<GridSettings>(stored.grid);
    const [dynamicInput, setDynamicInput] = useState<DynamicInputSettings>(stored.dynamicInput);
    const [layerPanel, setLayerPanel] = useState<LayerPanelState>(stored.layerPanel);
    useEffect(() => {
        saveSwitches({ snap: snapSettings, tracking, objectTracking, grid: gridSettings, dynamicInput, layerPanel });
    }, [snapSettings, tracking, objectTracking, gridSettings, dynamicInput, layerPanel]);
    const { preference, setPreference, theme } = useTheme();
    const fullscreen = useFullscreen();
    const fullscreenTitle = !fullscreen.lockable
        ? 'toolbar.fullscreenUnsupported'
        : fullscreen.active
          ? 'toolbar.fullscreenExit'
          : 'toolbar.fullscreen';

    // Shortcuts like AutoCAD: F3 switches the object snap (and must not open the browser's
    // search), F7 the grid (and must not start caret browsing), F8 Ortho, F10 polar tracking (and must not focus the browser's menu bar),
    // F11 object snap tracking (and must not switch the browser to full screen), F12 Dynamic Input
    // (and should not open the developer tools, which not every browser lets a page prevent),
    // Ctrl/Cmd+Z undoes, Ctrl+Y or Cmd+Shift+Z redoes
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            // A key the editor took (e.g. typed on the command line) does nothing else
            if (
                event.defaultPrevented ||
                (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]'))
            ) {
                return;
            }
            if (event.key === 'F3') {
                event.preventDefault();
                if (!event.repeat) {
                    setSnapSettings((settings) => ({ ...settings, enabled: !settings.enabled }));
                }
                return;
            }
            if (event.key === 'F7') {
                event.preventDefault();
                if (!event.repeat) {
                    setGridSettings((grid) => ({ ...grid, enabled: !grid.enabled }));
                }
                return;
            }
            if (event.key === 'F8') {
                event.preventDefault();
                if (!event.repeat) {
                    setTracking((modes) => withOrtho(modes, !modes.ortho));
                }
                return;
            }
            if (event.key === 'F10') {
                event.preventDefault();
                if (!event.repeat) {
                    setTracking((modes) => withPolar(modes, { ...modes.polar, enabled: !modes.polar.enabled }));
                }
                return;
            }
            if (event.key === 'F11') {
                event.preventDefault();
                if (!event.repeat) {
                    setObjectTracking((settings) => ({ ...settings, enabled: !settings.enabled }));
                }
                return;
            }
            if (event.key === 'F12') {
                event.preventDefault();
                if (!event.repeat) {
                    setDynamicInput((settings) => ({ ...settings, enabled: !settings.enabled }));
                }
                return;
            }
            if (!(event.ctrlKey || event.metaKey) || event.altKey) {
                return;
            }
            const key = event.key.toLowerCase();
            if (key === 'z' && !event.shiftKey) {
                event.preventDefault();
                canvasRef.current?.undo();
            } else if ((key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey)) {
                event.preventDefault();
                canvasRef.current?.redo();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    useEffect(() => {
        if (planId === null) {
            return;
        }
        if (stressCount > 0) {
            let cancelled = false;
            void import('app/dev/stressPlan').then(({ stressPlan }) => {
                if (!cancelled) {
                    setState({ status: 'loaded', document: stressPlan(stressCount) });
                }
            });
            return () => {
                cancelled = true;
            };
        }
        const controller = new AbortController();
        api.loadPlanDocument(planId, controller.signal).then(
            ({ document }) => setState({ status: 'loaded', document }),
            (error: Error) => {
                if (!controller.signal.aborted) {
                    setState({ status: 'error', message: error.message });
                }
            },
        );
        return () => controller.abort();
    }, [planId, stressCount]);

    if (planId === null) {
        return <p className="app-message">{t('app.noPlan')}</p>;
    }
    if (state.status === 'loading') {
        return <p className="app-message">{t('app.loading')}</p>;
    }
    if (state.status === 'error') {
        return <p className="app-message app-message-error">{t('app.loadFailed', { reason: state.message })}</p>;
    }
    // Loaded, so there is a history
    if (history === null) {
        return null;
    }
    const settings = DEFAULT_EDITOR_SETTINGS;
    const setLayersOpen = (open: boolean) => setLayerPanel((panel) => ({ ...panel, open }));
    const busy = selection?.command != null;

    return (
        <div className="app">
            <header className="toolbar">
                <div className="toolbar-tools" role="toolbar" aria-label={t('toolbar.history')}>
                    <button
                        type="button"
                        disabled={!selection?.canUndo}
                        onClick={() => canvasRef.current?.undo()}
                        title={t('toolbar.undoTitle')}
                    >
                        {t('toolbar.undo')}
                    </button>
                    <button
                        type="button"
                        disabled={!selection?.canRedo}
                        onClick={() => canvasRef.current?.redo()}
                        title={t('toolbar.redoTitle')}
                    >
                        {t('toolbar.redo')}
                    </button>
                </div>
                <span className="toolbar-title">{state.document.name}</span>
                <CollaborationStatus state={collaboration} />
                <button type="button" onClick={() => canvasRef.current?.fit()} title={t('toolbar.zoomExtentsTitle')}>
                    {t('toolbar.zoomExtents')}
                </button>
                <div className="toolbar-settings">
                    <ToolbarSelect
                        label={t('toolbar.theme')}
                        value={preference}
                        options={THEME_OPTIONS.map((option) => ({
                            value: option.value,
                            label: t(option.label),
                            menuLabel: t(option.label),
                            title: t(option.title),
                            icon: <ThemeIcon theme={option.value} />,
                        }))}
                        onChange={setPreference}
                    />
                    <ToolbarSelect
                        label={t('toolbar.language')}
                        value={language}
                        options={LANGUAGES.map((option) => ({
                            value: option,
                            label: option.toUpperCase(),
                            menuLabel: t(`language.${option}`),
                            lang: option,
                        }))}
                        onChange={setLanguage}
                    />
                    <button
                        type="button"
                        className="toolbar-exit"
                        onClick={() => window.location.assign(exitUrl())}
                        title={t('toolbar.exitTitle')}
                    >
                        {/* Leaving a frame: open box on the left, rounded arrow out to the right */}
                        <svg className="theme-icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9" />
                        </svg>
                        {t('toolbar.exit')}
                    </button>
                    {fullscreen.supported && (
                        // aria-disabled instead of disabled, so the tooltip with the reason still shows
                        <button
                            type="button"
                            className="toolbar-icon-button"
                            onClick={fullscreen.toggle}
                            aria-disabled={!fullscreen.lockable}
                            title={t(fullscreenTitle)}
                            aria-label={t(fullscreenTitle)}
                        >
                            <FullscreenIcon active={fullscreen.active} />
                        </button>
                    )}
                </div>
            </header>
            <ToolPanel
                command={selection?.command ?? null}
                onStart={(command, method) => canvasRef.current?.startCommand(command, method)}
                layersOpen={layerPanel.open}
                onLayersToggle={() => setLayerPanel(toggleLayerTab)}
            />
            <div className="workspace">
                <CadCanvas
                    ref={canvasRef}
                    history={history}
                    theme={theme}
                    settings={settings}
                    snapSettings={snapSettings}
                    polarSettings={tracking.polar}
                    ortho={tracking.ortho}
                    objectTrackingSettings={objectTracking}
                    gridSettings={gridSettings}
                    dynamicInputSettings={dynamicInput}
                    onViewportChange={setViewport}
                    onPointerChange={setPointer}
                    onSelectionChange={setSelection}
                    presence={presence}
                />
                <SidePanel
                    tabs={[
                        {
                            id: 'layers',
                            label: t('layers.title'),
                            content: (
                                <LayerPanel
                                    history={history}
                                    currentLayerId={selection?.currentLayerId ?? null}
                                    busy={busy}
                                    selection={selection?.command === null ? selection.highlighted : NO_SELECTION}
                                    theme={theme}
                                    onSetCurrent={(id) => canvasRef.current?.setCurrentLayer(id)}
                                    onAdd={() => canvasRef.current?.addLayer()}
                                    onUpdate={(id, changes) => canvasRef.current?.updateLayer(id, changes)}
                                    onRemove={(id) => canvasRef.current?.removeLayer(id)}
                                    onMoveSelection={(id) => canvasRef.current?.moveSelectionToLayer(id)}
                                    onSetAppearance={(changes) => canvasRef.current?.setSelectionAppearance(changes)}
                                    onSetStyle={(styleId) => canvasRef.current?.setSelectionStyle(styleId)}
                                />
                            ),
                        },
                        {
                            id: 'styles',
                            label: t('styles.title'),
                            content: (
                                <StylePanel
                                    history={history}
                                    busy={busy}
                                    theme={theme}
                                    onAdd={() => canvasRef.current?.addStyle() ?? null}
                                    onUpdate={(id, changes) => canvasRef.current?.updateStyle(id, changes)}
                                    onRemove={(id) => canvasRef.current?.removeStyle(id)}
                                />
                            ),
                        },
                    ]}
                    tab={layerPanel.tab}
                    onTabChange={(tab) => setLayerPanel((panel) => ({ ...panel, tab }))}
                    open={layerPanel.open}
                    width={layerPanelWidth(layerPanel, settings)}
                    minWidth={settings.layerPanelMinWidth}
                    maxWidth={settings.layerPanelMaxWidth}
                    defaultWidth={settings.layerPanelWidth}
                    onOpenChange={setLayersOpen}
                    onWidthChange={(width) => setLayerPanel((panel) => ({ ...panel, width }))}
                    texts={{ panel: t('layers.panel'), open: t('layers.open'), close: t('layers.close'), resize: t('layers.resize') }}
                />
            </div>
            {selection && (
                <CommandLine
                    prompt={selection.prompt}
                    input={selection.input}
                    acceptsInput={selection.acceptsInput}
                    message={selection.message}
                />
            )}
            <StatusBar
                viewport={viewport}
                pointer={pointer}
                snapSettings={snapSettings}
                onSnapSettingsChange={setSnapSettings}
                polarSettings={tracking.polar}
                onPolarSettingsChange={(polar) => setTracking((modes) => withPolar(modes, polar))}
                ortho={tracking.ortho}
                onOrthoChange={(ortho) => setTracking((modes) => withOrtho(modes, ortho))}
                objectTrackingSettings={objectTracking}
                onObjectTrackingSettingsChange={setObjectTracking}
                gridSettings={gridSettings}
                onGridSettingsChange={setGridSettings}
                dynamicInputSettings={dynamicInput}
                onDynamicInputSettingsChange={setDynamicInput}
            />
        </div>
    );
}

export default App;
