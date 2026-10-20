import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { SelectionOverlay } from 'app/cad/editor/overlays/SelectionOverlay';
import { SelectionEditor, type SelectionSnapshot } from 'app/cad/editor/SelectionEditor';
import type { CadDocument } from 'app/cad/model/CadDocument';
import type { Point } from 'app/cad/model/Point';
import { PaperRenderer } from 'app/cad/renderer/PaperRenderer';
import { Viewport, type Size } from 'app/cad/renderer/Viewport';
import { attachCanvasInput } from './canvasInput';

export interface CadCanvasHandle {
    fit(): void;
    /** Starts the AUSWAHL command, taking over the current pickfirst selection. */
    startSelectCommand(): void;
}

interface CadCanvasProps {
    document: CadDocument;
    onViewportChange?: (viewport: Viewport) => void;
    /** Pointer position in view px, or null when the pointer left the canvas. */
    onPointerChange?: (viewPoint: Point | null) => void;
    /** Selection and command state, e.g. for the command line; also sent once on start. */
    onSelectionChange?: (snapshot: SelectionSnapshot) => void;
    ref?: Ref<CadCanvasHandle>;
}

export function CadCanvas({ document, onViewportChange, onPointerChange, onSelectionChange, ref }: CadCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<PaperRenderer | null>(null);
    const editorRef = useRef<SelectionEditor | null>(null);
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

    useImperativeHandle(ref, () => ({ fit, startSelectCommand: () => editorRef.current?.startSelectCommand() }));

    useEffect(() => {
        const container = containerRef.current!;
        const canvas = canvasRef.current!;
        const renderer = new PaperRenderer(canvas);
        rendererRef.current = renderer;
        renderer.setViewport(viewportRef.current);
        renderer.setDocument(document);
        const editor = new SelectionEditor(document);
        const overlay = new SelectionOverlay(renderer);
        editorRef.current = editor;
        const refreshOverlay = () => overlay.render(editor.snapshot);
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
            if (needsFitRef.current) {
                fit();
            }
        });
        observer.observe(container);

        const detachInput = attachCanvasInput(canvas, {
            getViewport: () => viewportRef.current,
            onViewportChange: applyViewport,
            target: editor,
            onPointerMove: (viewPoint) => onPointerChangeRef.current?.(viewPoint),
            onPointerLeave: () => onPointerChangeRef.current?.(null),
        });

        return () => {
            detachInput();
            unsubscribe();
            refreshOverlayRef.current = null;
            editorRef.current = null;
            observer.disconnect();
            renderer.dispose();
            rendererRef.current = null;
            sizeRef.current = null;
            needsFitRef.current = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks read refs
    }, [document]);

    return (
        <div ref={containerRef} className="cad-canvas">
            <canvas ref={canvasRef} />
        </div>
    );
}
