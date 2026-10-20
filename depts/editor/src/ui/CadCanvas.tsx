import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import type { CadDocument } from 'app/cad/model/CadDocument';
import type { Point } from 'app/cad/model/Point';
import { PaperRenderer } from 'app/cad/renderer/PaperRenderer';
import { Viewport, type Size } from 'app/cad/renderer/Viewport';
import { attachViewportNavigation } from './viewportNavigation';

export interface CadCanvasHandle {
    fit(): void;
}

interface CadCanvasProps {
    document: CadDocument;
    onViewportChange?: (viewport: Viewport) => void;
    /** Pointer position in view px, or null when the pointer left the canvas. */
    onPointerChange?: (viewPoint: Point | null) => void;
    ref?: Ref<CadCanvasHandle>;
}

export function CadCanvas({ document, onViewportChange, onPointerChange, ref }: CadCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<PaperRenderer | null>(null);
    const viewportRef = useRef(new Viewport());
    const sizeRef = useRef<Size | null>(null);
    const needsFitRef = useRef(true);
    const onViewportChangeRef = useRef(onViewportChange);
    const onPointerChangeRef = useRef(onPointerChange);
    useEffect(() => {
        onViewportChangeRef.current = onViewportChange;
        onPointerChangeRef.current = onPointerChange;
    });

    const applyViewport = (viewport: Viewport) => {
        viewportRef.current = viewport;
        rendererRef.current?.setViewport(viewport);
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

    useImperativeHandle(ref, () => ({ fit }));

    useEffect(() => {
        const container = containerRef.current!;
        const canvas = canvasRef.current!;
        const renderer = new PaperRenderer(canvas);
        rendererRef.current = renderer;
        renderer.setViewport(viewportRef.current);
        renderer.setDocument(document);

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

        const detachNavigation = attachViewportNavigation(canvas, {
            getViewport: () => viewportRef.current,
            onViewportChange: applyViewport,
            onPointerMove: (viewPoint) => onPointerChangeRef.current?.(viewPoint),
            onPointerLeave: () => onPointerChangeRef.current?.(null),
        });

        return () => {
            detachNavigation();
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
