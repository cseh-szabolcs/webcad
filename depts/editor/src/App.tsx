import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { commandName } from 'app/cad/editor/commandNames';
import type { SelectionSnapshot } from 'app/cad/editor/SelectionEditor';
import type { CadDocument } from 'app/cad/model/CadDocument';
import { currentLanguage, LANGUAGES, setLanguage } from 'app/i18n/i18n';
import type { Point } from 'app/cad/model/Point';
import { CadApiClient } from 'app/cad/persistence/CadApiClient';
import {
    DEFAULT_EDITOR_SETTINGS,
    DEFAULT_GRID_SETTINGS,
    DEFAULT_OBJECT_TRACKING_SETTINGS,
    DEFAULT_SNAP_SETTINGS,
    DEFAULT_TRACKING_MODES,
    type GridSettings,
    type ObjectTrackingSettings,
    type SnapSettings,
    type TrackingModes,
    withOrtho,
    withPolar,
} from 'app/settings/editorSettings';
import type { Viewport } from 'app/cad/renderer/Viewport';
import { CadCanvas, type CadCanvasHandle } from 'app/ui/CadCanvas';
import { CommandLine } from 'app/ui/CommandLine';
import { FullscreenIcon } from 'app/ui/FullscreenIcon';
import { useFullscreen } from 'app/ui/fullscreen';
import { StatusBar } from 'app/ui/StatusBar';
import { ThemeIcon } from 'app/ui/ThemeIcon';
import { ToolbarSelect } from 'app/ui/ToolbarSelect';
import { useTheme, type ThemePreference } from 'app/ui/theme';
import './App.css';

/** Plan served from the backend fixtures; used in dev when no ?plan= is given. */
const DEV_PLAN_ID = '01994f4e-6f3a-7c2d-9b1e-5a3c2d1e0f42';

const api = new CadApiClient();

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
    const planId = new URLSearchParams(window.location.search).get('plan') ?? (import.meta.env.DEV ? DEV_PLAN_ID : null);
    const canvasRef = useRef<CadCanvasHandle>(null);
    const [viewport, setViewport] = useState<Viewport | null>(null);
    const [pointer, setPointer] = useState<Point | null>(null);
    const [selection, setSelection] = useState<SelectionSnapshot | null>(null);
    const [state, setState] = useState<LoadState>({ status: 'loading' });
    const [snapSettings, setSnapSettings] = useState<SnapSettings>(DEFAULT_SNAP_SETTINGS);
    const [tracking, setTracking] = useState<TrackingModes>(DEFAULT_TRACKING_MODES);
    const [objectTracking, setObjectTracking] = useState<ObjectTrackingSettings>(DEFAULT_OBJECT_TRACKING_SETTINGS);
    const [gridSettings, setGridSettings] = useState<GridSettings>(DEFAULT_GRID_SETTINGS);
    const { preference, setPreference, theme } = useTheme();
    const fullscreen = useFullscreen();

    // Shortcuts like AutoCAD: F3 switches the object snap (and must not open the browser's
    // search), F7 the grid (and must not start caret browsing), F8 Ortho, F10 polar tracking (and must not focus the browser's menu bar),
    // F11 object snap tracking (and must not switch the browser to full screen),
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
    }, [planId]);

    if (planId === null) {
        return <p className="app-message">{t('app.noPlan')}</p>;
    }
    if (state.status === 'loading') {
        return <p className="app-message">{t('app.loading')}</p>;
    }
    if (state.status === 'error') {
        return <p className="app-message app-message-error">{t('app.loadFailed', { reason: state.message })}</p>;
    }

    return (
        <div className="app">
            <header className="toolbar">
                <div className="toolbar-tools" role="toolbar" aria-label={t('toolbar.tools')}>
                    <button
                        type="button"
                        aria-pressed={selection?.command === 'MOVE'}
                        onClick={() => canvasRef.current?.startMoveCommand()}
                        title={t('toolbar.moveTitle', { command: commandName('MOVE') })}
                    >
                        {t('toolbar.move')}
                    </button>
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
                <button type="button" onClick={() => canvasRef.current?.fit()} title={t('toolbar.zoomExtentsTitle')}>
                    {t('toolbar.zoomExtents')}
                </button>
                <div className="toolbar-settings">
                    <ToolbarSelect
                        label={t('toolbar.theme')}
                        title={t('toolbar.themeMenuTitle')}
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
                        title={t('toolbar.languageMenuTitle')}
                        value={language}
                        options={LANGUAGES.map((option) => ({
                            value: option,
                            label: option.toUpperCase(),
                            menuLabel: t(`language.${option}`),
                            lang: option,
                        }))}
                        onChange={setLanguage}
                    />
                    {fullscreen.supported && (
                        <button
                            type="button"
                            className="toolbar-icon-button"
                            onClick={fullscreen.toggle}
                            title={t(fullscreen.active ? 'toolbar.fullscreenExit' : 'toolbar.fullscreen')}
                            aria-label={t(fullscreen.active ? 'toolbar.fullscreenExit' : 'toolbar.fullscreen')}
                        >
                            <FullscreenIcon active={fullscreen.active} />
                        </button>
                    )}
                </div>
            </header>
            <CadCanvas
                ref={canvasRef}
                document={state.document}
                theme={theme}
                settings={DEFAULT_EDITOR_SETTINGS}
                snapSettings={snapSettings}
                polarSettings={tracking.polar}
                ortho={tracking.ortho}
                objectTrackingSettings={objectTracking}
                gridSettings={gridSettings}
                onViewportChange={setViewport}
                onPointerChange={setPointer}
                onSelectionChange={setSelection}
            />
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
            />
        </div>
    );
}

export default App;
