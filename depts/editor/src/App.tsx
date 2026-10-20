import { useEffect, useRef, useState } from 'react';
import type { SelectionSnapshot } from 'app/cad/editor/SelectionEditor';
import type { CadDocument } from 'app/cad/model/CadDocument';
import type { Point } from 'app/cad/model/Point';
import { CadApiClient } from 'app/cad/persistence/CadApiClient';
import type { Viewport } from 'app/cad/renderer/Viewport';
import { CadCanvas, type CadCanvasHandle } from 'app/ui/CadCanvas';
import { CommandLine } from 'app/ui/CommandLine';
import { StatusBar } from 'app/ui/StatusBar';
import { useTheme, type ThemePreference } from 'app/ui/theme';
import './App.css';

/** Plan served from the backend fixtures; used in dev when no ?plan= is given. */
const DEV_PLAN_ID = '01994f4e-6f3a-7c2d-9b1e-5a3c2d1e0f42';

const api = new CadApiClient();

const THEME_OPTIONS: { value: ThemePreference; label: string; title: string }[] = [
    { value: 'light', label: 'Hell', title: 'Heller Hintergrund' },
    { value: 'dark', label: 'Dunkel', title: 'Dunkler Hintergrund' },
    { value: 'system', label: 'System', title: 'Wie die Systemeinstellung' },
];

type LoadState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'loaded'; document: CadDocument };

function App() {
    const planId = new URLSearchParams(window.location.search).get('plan') ?? (import.meta.env.DEV ? DEV_PLAN_ID : null);
    const canvasRef = useRef<CadCanvasHandle>(null);
    const [viewport, setViewport] = useState<Viewport | null>(null);
    const [pointer, setPointer] = useState<Point | null>(null);
    const [selection, setSelection] = useState<SelectionSnapshot | null>(null);
    const [state, setState] = useState<LoadState>({ status: 'loading' });
    const { preference, setPreference, theme } = useTheme();

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
        return <p className="app-message">No plan selected.</p>;
    }
    if (state.status === 'loading') {
        return <p className="app-message">Loading plan…</p>;
    }
    if (state.status === 'error') {
        return <p className="app-message app-message-error">{state.message}</p>;
    }

    return (
        <div className="app">
            <header className="toolbar">
                <div className="toolbar-tools" role="toolbar" aria-label="Werkzeuge">
                    <button
                        type="button"
                        aria-pressed={selection?.command === 'AUSWAHL'}
                        onClick={() => canvasRef.current?.startSelectCommand()}
                        title="Objekte wählen (AUSWAHL)"
                    >
                        Auswahl
                    </button>
                </div>
                <span className="toolbar-title">{state.document.name}</span>
                <button type="button" onClick={() => canvasRef.current?.fit()} title="Alles zeigen">
                    Zoom Grenzen
                </button>
                <div className="toolbar-theme" role="group" aria-label="Darstellung">
                    <span className="toolbar-theme-label">Darstellung</span>
                    {THEME_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={preference === option.value}
                            onClick={() => setPreference(option.value)}
                            title={option.title}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </header>
            <CadCanvas
                ref={canvasRef}
                document={state.document}
                theme={theme}
                onViewportChange={setViewport}
                onPointerChange={setPointer}
                onSelectionChange={setSelection}
            />
            {selection && <CommandLine prompt={selection.prompt} message={selection.message} />}
            <StatusBar viewport={viewport} pointer={pointer} />
        </div>
    );
}

export default App;
