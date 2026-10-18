import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import type { CadEditor } from 'app/cad/editor/CadEditor';
import { attachCanvasInput } from 'app/cad/editor/CanvasInputController';
import { PaperEditorView } from 'app/cad/editor/PaperEditorView';
import { PaperRenderer } from 'app/cad/renderer/PaperRenderer';
import { Viewport, type Size } from 'app/cad/renderer/Viewport';

export interface CadCanvasHandle {
    fit(): void;
}

interface CadCanvasProps {
    editor: CadEditor;
    onViewportChange?: (viewport: Viewport) => void;
    ref?: Ref<CadCanvasHandle>;
}

export function CadCanvas({ editor, onViewportChange, ref }: CadCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<PaperRenderer | null>(null);
    const viewRef = useRef<PaperEditorView | null>(null);
    const viewportRef = useRef(new Viewport());
    const sizeRef = useRef<Size | null>(null);
    const needsFitRef = useRef(true);
    const onViewportChangeRef = useRef(onViewportChange);
    onViewportChangeRef.current = onViewportChange;

    const applyViewport = (viewport: Viewport) => {
        viewportRef.current = viewport;
        rendererRef.current?.setViewport(viewport);
        viewRef.current?.refresh();
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
        const view = new PaperEditorView(renderer);
        viewRef.current = view;
        editor.attachView(view);

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
        });

        return () => {
            detachInput();
            observer.disconnect();
            editor.detachView();
            renderer.dispose();
            rendererRef.current = null;
            viewRef.current = null;
            sizeRef.current = null;
            needsFitRef.current = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks read refs
    }, [editor]);

    return (
        <div ref={containerRef} className="cad-canvas">
            <canvas ref={canvasRef} />
        </div>
    );
}
