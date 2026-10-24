import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { SelectionOverlay } from 'app/cad/editor/overlays/SelectionOverlay';
import { SelectionEditor, type SelectionSnapshot } from 'app/cad/editor/SelectionEditor';
import type { CadDocument } from 'app/cad/model/CadDocument';
import type { Point } from 'app/cad/model/Point';
import type { DisplayTheme } from 'app/cad/renderer/displayColor';
import { PaperRenderer } from 'app/cad/renderer/PaperRenderer';
import { Viewport, type Size } from 'app/cad/renderer/Viewport';
import type { EditorSettings, SnapSettings } from 'app/settings/editorSettings';
import { attachCanvasInput } from './canvasInput';
import { CrosshairCursor } from './CrosshairCursor';
import { SnapMarker } from './SnapMarker';

export interface CadCanvasHandle {
    fit(): void;
    /** Starts the SCHIEBEN command, taking over the current pickfirst selection. */
    startMoveCommand(): void;
}

interface CadCanvasProps {
    document: CadDocument;
    /** Background the drawing is shown on; drawing and overlay colours follow it. */
    theme: DisplayTheme;
    /** Crosshair, pick box, aperture and snap display; read when the document is loaded. */
    settings: EditorSettings;
    /** Running object snaps; may change at any time. */
    snapSettings: SnapSettings;
    onViewportChange?: (viewport: Viewport) => void;
    /**
     * Pointer position in view px (the snap point while the magnet holds the cursor there),
     * or null when the pointer left the canvas.
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
    const themeRef = useRef(theme);
    const settingsRef = useRef(settings);
    const snapSettingsRef = useRef(snapSettings);
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

    useImperativeHandle(ref, () => ({ fit, startMoveCommand: () => editorRef.current?.startMoveCommand() }));

    useEffect(() => {
        const container = containerRef.current!;
        const canvas = canvasRef.current!;
        const renderer = new PaperRenderer(canvas);
        rendererRef.current = renderer;
        renderer.setViewport(viewportRef.current);
        renderer.setTheme(themeRef.current);
        renderer.setDocument(document);
        const editor = new SelectionEditor(document, settingsRef.current);
        editor.setSnapSettings(snapSettingsRef.current);
        const crosshair = new CrosshairCursor(container, settingsRef.current);
        const snapMarker = new SnapMarker(container, settingsRef.current);
        const overlay = new SelectionOverlay(renderer);
        overlay.setTheme(themeRef.current);
        overlayRef.current = overlay;
        editorRef.current = editor;

        /**
         * Where the cursor shows: on the snap point while the magnet holds it, else at the
         * pointer. A remote centre does not pull the cursor away from the curve.
         */
        const cursorAt = (viewPoint: Point): Point => {
            const snap = editor.snapshot.snap;
            return snap && !snap.remote && settingsRef.current.snapMagnet
                ? viewportRef.current.modelToView(snap.point)
                : viewPoint;
        };
        /** Pointer position while the crosshair shows, so it can follow snap and zoom changes. */
        let crosshairAt: Point | null = null;
        const refreshOverlay = () => {
            const { snap, basePoint, cursor } = editor.snapshot;
            const viewport = viewportRef.current;
            overlay.render(editor.snapshot);
            snapMarker.show(snap && { viewPoint: viewport.modelToView(snap.point), mode: snap.mode });
            snapMarker.showBasePoint(basePoint && viewport.modelToView(basePoint));
            crosshair.setMode(cursor);
            if (crosshairAt) {
                crosshair.moveTo(cursorAt(crosshairAt));
            }
        };
        refreshOverlayRef.current = refreshOverlay;
        const unsubscribe = editor.subscribe(() => {
            refreshOverlay();
            onSelectionChangeRef.current?.(editor.snapshot);
        });
        onSelectionChangeRef.current?.(editor.snapshot);

        const observer = new ResizeObserver(([entry]) => {
            const size = { width: entry.contentRect.width, height: entry.contentRect.height };
            if (size.width === 0 || size.height === 0) {
                return;
            }
            sizeRef.current = size;
            renderer.resize(size);
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
                },
                hide: () => {
                    crosshairAt = null;
                    crosshair.hide();
                },
                setRemoving: (removing) => crosshair.setRemoving(removing),
            },
            onPointerMove: (viewPoint) => onPointerChangeRef.current?.(cursorAt(viewPoint)),
            onPointerLeave: () => onPointerChangeRef.current?.(null),
        });

        return () => {
            detachInput();
            crosshair.dispose();
            snapMarker.dispose();
            unsubscribe();
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
        themeRef.current = theme;
        rendererRef.current?.setTheme(theme);
        overlayRef.current?.setTheme(theme);
        refreshOverlayRef.current?.();
    }, [theme]);

    return (
        <div ref={containerRef} className="cad-canvas">
            <canvas ref={canvasRef} />
        </div>
    );
}
