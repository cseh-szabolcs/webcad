import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { DocumentHistory } from 'app/cad/editor/commands/DocumentHistory';
import { SelectionOverlay } from 'app/cad/editor/overlays/SelectionOverlay';
import { SelectionEditor, type EditorCommand, type SelectionSnapshot } from 'app/cad/editor/SelectionEditor';
import type { CadDocument } from 'app/cad/model/CadDocument';
import type { Point } from 'app/cad/model/Point';
import type { DisplayTheme } from 'app/cad/renderer/displayColor';
import { i18n } from 'app/i18n/i18n';
import { PaperRenderer } from 'app/cad/renderer/PaperRenderer';
import { Viewport, type Size } from 'app/cad/renderer/Viewport';
import type {
    DynamicInputSettings,
    EditorSettings,
    GridSettings,
    ObjectTrackingSettings,
    PolarSettings,
    SnapSettings,
} from 'app/settings/editorSettings';
import { attachCanvasInput } from './canvasInput';
import { CrosshairCursor } from './CrosshairCursor';
import { DynamicInputLayer } from './DynamicInputLayer';
import { GridLayer } from './GridLayer';
import { polarTooltipText, SnapMarker, trackingTooltipText, type TrackingDisplay } from './SnapMarker';
import { UcsIcon } from './UcsIcon';

const NOTHING: ReadonlySet<string> = new Set();

export interface CadCanvasHandle {
    fit(): void;
    /** Starts a command (SCHIEBEN takes over the current pickfirst selection); cancels another running one. */
    startCommand(command: EditorCommand): void;
    /** Undo and redo of document changes; ignored while a command runs. */
    undo(): void;
    redo(): void;
}

interface CadCanvasProps {
    /** Loaded document; the canvas keeps its own history of changes to it. */
    document: CadDocument;
    /** Background the drawing is shown on; drawing and overlay colours follow it. */
    theme: DisplayTheme;
    /** Crosshair, pick box, aperture, snap display, preview colour and UCS icon; read when the document is loaded. */
    settings: EditorSettings;
    /** Running object snaps; may change at any time. */
    snapSettings: SnapSettings;
    /** Polar tracking; may change at any time. */
    polarSettings: PolarSettings;
    /** Ortho mode (F8); may change at any time. */
    ortho: boolean;
    /** Object snap tracking (F11); may change at any time. */
    objectTrackingSettings: ObjectTrackingSettings;
    /** Grid display (F7); may change at any time. */
    gridSettings: GridSettings;
    /** Dynamic Input (F12); may change at any time. */
    dynamicInputSettings: DynamicInputSettings;
    onViewportChange?: (viewport: Viewport) => void;
    /**
     * Pointer position in view px (the snap or tracking point while the magnet holds
     * the cursor there), or null when the pointer left the canvas.
     */
    onPointerChange?: (viewPoint: Point | null) => void;
    /** Selection and command state, e.g. for the command line; also sent once on start. */
    onSelectionChange?: (snapshot: SelectionSnapshot) => void;
    ref?: Ref<CadCanvasHandle>;
}

export function CadCanvas({
    document,
    theme,
    settings,
    snapSettings,
    polarSettings,
    ortho,
    objectTrackingSettings,
    gridSettings,
    dynamicInputSettings,
    onViewportChange,
    onPointerChange,
    onSelectionChange,
    ref,
}: CadCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<PaperRenderer | null>(null);
    const editorRef = useRef<SelectionEditor | null>(null);
    const overlayRef = useRef<SelectionOverlay | null>(null);
    const snapMarkerRef = useRef<SnapMarker | null>(null);
    const gridRef = useRef<GridLayer | null>(null);
    const ucsIconRef = useRef<UcsIcon | null>(null);
    const themeRef = useRef(theme);
    const settingsRef = useRef(settings);
    const snapSettingsRef = useRef(snapSettings);
    const polarSettingsRef = useRef(polarSettings);
    const orthoRef = useRef(ortho);
    const objectTrackingSettingsRef = useRef(objectTrackingSettings);
    const gridSettingsRef = useRef(gridSettings);
    const dynamicInputSettingsRef = useRef(dynamicInputSettings);
    const viewportRef = useRef(new Viewport());
    const sizeRef = useRef<Size | null>(null);
    const needsFitRef = useRef(true);
    /** Redraws the editor overlay, whose grips depend on the zoom. */
    const refreshOverlayRef = useRef<(() => void) | null>(null);
    const onViewportChangeRef = useRef(onViewportChange);
    const onPointerChangeRef = useRef(onPointerChange);
    const onSelectionChangeRef = useRef(onSelectionChange);
    useEffect(() => {
        onViewportChangeRef.current = onViewportChange;
        onPointerChangeRef.current = onPointerChange;
        onSelectionChangeRef.current = onSelectionChange;
        settingsRef.current = settings;
    });

    const applyViewport = (viewport: Viewport) => {
        viewportRef.current = viewport;
        rendererRef.current?.setViewport(viewport);
        gridRef.current?.setViewport(viewport);
        ucsIconRef.current?.setViewport(viewport);
        refreshOverlayRef.current?.();
        onViewportChangeRef.current?.(viewport);
    };

    const fit = () => {
        const renderer = rendererRef.current;
        const size = sizeRef.current;
        if (!renderer || !size) {
            needsFitRef.current = true;
            return;
        }
        needsFitRef.current = false;
        const bounds = renderer.getContentBounds();
        if (bounds) {
            applyViewport(Viewport.fitBounds(bounds, size));
        }
    };

    useImperativeHandle(ref, () => ({
        fit,
        startCommand: (command) => editorRef.current?.startCommand(command),
        undo: () => editorRef.current?.undo(),
        redo: () => editorRef.current?.redo(),
    }));

    useEffect(() => {
        const container = containerRef.current!;
        const canvas = canvasRef.current!;
        const renderer = new PaperRenderer(canvas);
        rendererRef.current = renderer;
        renderer.setViewport(viewportRef.current);
        renderer.setTheme(themeRef.current);
        renderer.setDocument(document);
        const grid = new GridLayer(container, settingsRef.current, themeRef.current, gridSettingsRef.current);
        grid.setViewport(viewportRef.current);
        gridRef.current = grid;
        // Created before the crosshair and the snap marker, so they lie above it
        const ucsIcon = new UcsIcon(container, settingsRef.current);
        ucsIcon.setViewport(viewportRef.current);
        ucsIconRef.current = ucsIcon;
        const history = new DocumentHistory(document);
        // Subscribed before the editor, so the paths are up to date when its overlay redraws
        const unsubscribeHistory = history.subscribe(({ document, changedElementIds }) =>
            renderer.updateElements(document, changedElementIds),
        );
        const editor = new SelectionEditor(history, settingsRef.current);
        editor.setSnapSettings(snapSettingsRef.current);
        editor.setPolarSettings(polarSettingsRef.current);
        editor.setOrtho(orthoRef.current);
        editor.setObjectTrackingSettings(objectTrackingSettingsRef.current);
        editor.setDynamicInputSettings(dynamicInputSettingsRef.current);
        const crosshair = new CrosshairCursor(container, settingsRef.current);
        const snapMarker = new SnapMarker(container, settingsRef.current, themeRef.current);
        snapMarkerRef.current = snapMarker;
        // Above the snap display, whose tooltips it must not hide
        const dynamicLayer = new DynamicInputLayer(container);
        const overlay = new SelectionOverlay(renderer);
        overlay.setTheme(themeRef.current);
        overlayRef.current = overlay;
        editorRef.current = editor;

        /**
         * Where the cursor shows: on the snap point, the object snap tracking point or the polar
         * tracking point while the magnet holds it, else at the pointer.
         */
        const cursorAt = (viewPoint: Point): Point => {
            const { snap, objectTrack, polar } = editor.snapshot;
            const held = snap?.point ?? objectTrack?.point ?? polar?.point;
            return held && settingsRef.current.snapMagnet ? viewportRef.current.modelToView(held) : viewPoint;
        };
        /** Pointer position while the crosshair shows, so it can follow snap and zoom changes. */
        let crosshairAt: Point | null = null;
        /**
         * Dynamic Input next to the crosshair: the prompt (or a typed command name) with the
         * prompts on, the fields at the crosshair or, for distance and angle from the prompt's
         * `from` point, on a dimension.
         */
        const refreshDynamicInput = () => {
            const { command, prompt, input, dynamicInput, from } = editor.snapshot;
            const dynamic = dynamicInputSettingsRef.current;
            const view = (point: Point) => viewportRef.current.modelToView(point);
            let promptText: string | null = null;
            if (dynamic.enabled && dynamic.prompts) {
                if (command !== null) {
                    // Typed text without fields shows after the prompt, as on the command line
                    promptText = dynamicInput === null && input !== '' ? `${prompt} ${input}` : prompt;
                } else if (input !== '') {
                    promptText = input;
                }
            }
            const point = dynamicInput?.point ?? null;
            const onDimension =
                dynamicInput?.layout === 'dimension' && dynamicInput.format !== 'cartesian' && dynamicInput.relative;
            dynamicLayer.show({
                cursor: crosshairAt && cursorAt(crosshairAt),
                prompt: promptText,
                fields: dynamicInput?.fields ?? null,
                dimension: onDimension && from && point ? { from: view(from), to: view(point) } : null,
                bound: dynamicInput?.bound && point ? view(point) : null,
            });
        };
        const refreshOverlay = () => {
            const { snap, snapCycle, snapPreview, polar, acquired, objectTrack, from, preview, previewPoint, cursor } =
                editor.snapshot;
            const viewport = viewportRef.current;
            // While moving, the originals show dimmed under the preview, like AutoCAD
            const basePoint = preview === 'move' ? from : null;
            // Also from the last point while PLINIE measures a length
            const rubberBandFrom = basePoint ?? (typeof preview === 'object' && preview?.direction ? from : null);
            renderer.setDimmed(basePoint ? editor.snapshot.highlighted : NOTHING);
            overlay.render(editor.snapshot);
            snapMarker.showPreview(
                snapPreview.map(({ point, mode }) => ({ viewPoint: viewport.modelToView(point), mode })),
            );
            snapMarker.show(snap && { viewPoint: viewport.modelToView(snap.point), mode: snap.mode, cycle: snapCycle });
            snapMarker.showBasePoint(basePoint && viewport.modelToView(basePoint));
            snapMarker.showRubberBand(
                rubberBandFrom &&
                    previewPoint && { from: viewport.modelToView(rubberBandFrom), to: viewport.modelToView(previewPoint) },
            );
            const view = (point: Point) => viewport.modelToView(point);
            let tracking: TrackingDisplay | null = null;
            if (objectTrack) {
                tracking = {
                    // The Ortho axis shows no path, like Ortho itself
                    paths: objectTrack.paths
                        .filter(({ source }) => source !== 'ortho')
                        .map(({ origin }) => ({ from: view(origin), through: view(objectTrack.point) })),
                    point: view(objectTrack.point),
                    tooltip: trackingTooltipText(objectTrack),
                };
            } else if (polar && from) {
                tracking = {
                    paths: [{ from: view(from), through: view(polar.point) }],
                    point: view(polar.point),
                    tooltip: polarTooltipText(polar.distance, polar.angle),
                };
            }
            snapMarker.showTracking(tracking);
            snapMarker.showAcquired(acquired.map(({ point }) => view(point)));
            crosshair.setMode(cursor);
            if (crosshairAt) {
                crosshair.moveTo(cursorAt(crosshairAt));
            }
            refreshDynamicInput();
        };
        refreshOverlayRef.current = refreshOverlay;
        const unsubscribe = editor.subscribe(() => {
            refreshOverlay();
            onSelectionChangeRef.current?.(editor.snapshot);
        });
        onSelectionChangeRef.current?.(editor.snapshot);
        // The prompt always changes with the language, so this also redraws the tooltips
        const refreshTexts = () => editor.refreshTexts();
        i18n.on('languageChanged', refreshTexts);

        const observer = new ResizeObserver(([entry]) => {
            const size = { width: entry.contentRect.width, height: entry.contentRect.height };
            if (size.width === 0 || size.height === 0) {
                return;
            }
            sizeRef.current = size;
            renderer.resize(size);
            grid.resize(size);
            ucsIcon.resize(size);
            crosshair.update(size, settingsRef.current);
            if (needsFitRef.current) {
                fit();
            }
        });
        observer.observe(container);

        const detachInput = attachCanvasInput(canvas, {
            getViewport: () => viewportRef.current,
            onViewportChange: applyViewport,
            target: editor,
            crosshair: {
                moveTo: (viewPoint) => {
                    crosshairAt = viewPoint;
                    crosshair.moveTo(cursorAt(viewPoint));
                    refreshDynamicInput();
                },
                hide: () => {
                    crosshairAt = null;
                    crosshair.hide();
                    refreshDynamicInput();
                },
                setRemoving: (removing) => crosshair.setRemoving(removing),
            },
            onPointerMove: (viewPoint) => onPointerChangeRef.current?.(cursorAt(viewPoint)),
            onPointerLeave: () => onPointerChangeRef.current?.(null),
        });

        return () => {
            detachInput();
            crosshair.dispose();
            dynamicLayer.dispose();
            snapMarker.dispose();
            snapMarkerRef.current = null;
            grid.dispose();
            gridRef.current = null;
            ucsIcon.dispose();
            ucsIconRef.current = null;
            i18n.off('languageChanged', refreshTexts);
            unsubscribe();
            editor.dispose();
            unsubscribeHistory();
            refreshOverlayRef.current = null;
            editorRef.current = null;
            overlayRef.current = null;
            observer.disconnect();
            renderer.dispose();
            rendererRef.current = null;
            sizeRef.current = null;
            needsFitRef.current = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks read refs
    }, [document]);

    useEffect(() => {
        snapSettingsRef.current = snapSettings;
        editorRef.current?.setSnapSettings(snapSettings);
    }, [snapSettings]);

    useEffect(() => {
        polarSettingsRef.current = polarSettings;
        editorRef.current?.setPolarSettings(polarSettings);
    }, [polarSettings]);

    useEffect(() => {
        orthoRef.current = ortho;
        editorRef.current?.setOrtho(ortho);
    }, [ortho]);

    useEffect(() => {
        objectTrackingSettingsRef.current = objectTrackingSettings;
        editorRef.current?.setObjectTrackingSettings(objectTrackingSettings);
    }, [objectTrackingSettings]);

    useEffect(() => {
        dynamicInputSettingsRef.current = dynamicInputSettings;
        editorRef.current?.setDynamicInputSettings(dynamicInputSettings);
        // Switching the prompts alone leaves the editor's snapshot unchanged
        refreshOverlayRef.current?.();
    }, [dynamicInputSettings]);

    useEffect(() => {
        gridSettingsRef.current = gridSettings;
        gridRef.current?.setGrid(gridSettings);
    }, [gridSettings]);

    useEffect(() => {
        themeRef.current = theme;
        rendererRef.current?.setTheme(theme);
        overlayRef.current?.setTheme(theme);
        snapMarkerRef.current?.setTheme(theme);
        gridRef.current?.setTheme(theme);
        refreshOverlayRef.current?.();
    }, [theme]);

    return (
        <div ref={containerRef} className="cad-canvas">
            <canvas ref={canvasRef} />
        </div>
    );
}
