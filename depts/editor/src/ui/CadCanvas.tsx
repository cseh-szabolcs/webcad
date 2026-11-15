import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import type { DocumentHistory } from 'app/cad/editor/commands/DocumentHistory';
import { applyDocumentPatch, diffDocuments, type DocumentPatch } from 'app/cad/editor/commands/DocumentPatch';
import { SelectionOverlay } from 'app/cad/editor/overlays/SelectionOverlay';
import { SelectionEditor, type EditorCommand, type SelectionSnapshot } from 'app/cad/editor/SelectionEditor';
import type { CommandMethod } from 'app/cad/editor/tools/CommandMethod';
import type { LayerChanges } from 'app/cad/editor/commands/LayerCommands';
import type { Id, Point } from 'app/cad/model/Point';
import type { DisplayTheme } from 'app/cad/renderer/displayColor';
import type { PresenceChannel } from 'app/collaboration/createCollaboration';
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
import { GripMenu } from './GripMenu';
import { RemoteCursors } from './RemoteCursors';
import { RemoteSelections, selectionLabels } from './RemoteSelections';
import { polarTooltipText, SnapMarker, trackingTooltipText, type TrackingDisplay } from './SnapMarker';
import { UcsIcon } from './UcsIcon';
import { ViewCompass } from './ViewCompass';

const NOTHING: ReadonlySet<string> = new Set();

export interface CadCanvasHandle {
    fit(): void;
    /** Starts a command (SCHIEBEN takes over the current pickfirst selection; BOGEN, KREIS and ELLIPSE with `method`); cancels another running one. */
    startCommand(command: EditorCommand, method?: CommandMethod): void;
    /** Undo and redo of document changes; ignored while a command runs. */
    undo(): void;
    redo(): void;
    /** The layers of the shown floor (see SelectionEditor): a refusal shows on the command line. */
    setCurrentLayer(id: Id): void;
    addLayer(): void;
    updateLayer(id: Id, changes: LayerChanges): void;
    removeLayer(id: Id): void;
    /** Puts the selection on that layer. */
    moveSelectionToLayer(id: Id): void;
}

interface CadCanvasProps {
    /** The loaded document with its changes; the canvas shows and edits what it holds. */
    history: DocumentHistory;
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
    /**
     * The pointers and selections of the other collaborators: shown on the canvas, and the cursor
     * shown here (model coordinates) and the selection are told to them. What the others selected
     * cannot be picked here. Null while there is nobody to share with.
     */
    presence?: PresenceChannel | null;
    ref?: Ref<CadCanvasHandle>;
}

export function CadCanvas({
    history,
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
    presence = null,
    ref,
}: CadCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<PaperRenderer | null>(null);
    const editorRef = useRef<SelectionEditor | null>(null);
    const overlayRef = useRef<SelectionOverlay | null>(null);
    const snapMarkerRef = useRef<SnapMarker | null>(null);
    const gridRef = useRef<GridLayer | null>(null);
    const ucsIconRef = useRef<UcsIcon | null>(null);
    const compassRef = useRef<ViewCompass | null>(null);
    const remoteCursorsRef = useRef<RemoteCursors | null>(null);
    const presenceRef = useRef(presence);
    /** Tells the others where the crosshair shows now and what is selected; set while a document is loaded. */
    const sharePresenceRef = useRef<(() => void) | null>(null);
    /** Locks, fades and names what the others selected; set while a document is loaded. */
    const showSelectionsRef = useRef<(() => void) | null>(null);
    const remoteSelectionsRef = useRef<RemoteSelections | null>(null);
    /** Takes over a change another collaborator made; set while a document is loaded. */
    const applyChangeRef = useRef<((patch: DocumentPatch, userId: string) => void) | null>(null);
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
        remoteCursorsRef.current?.setViewport(viewport);
        remoteSelectionsRef.current?.setViewport(viewport);
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
        startCommand: (command, method) => editorRef.current?.startCommand(command, method),
        undo: () => editorRef.current?.undo(),
        redo: () => editorRef.current?.redo(),
        setCurrentLayer: (id) => editorRef.current?.setCurrentLayer(id),
        addLayer: () => editorRef.current?.addLayer(),
        updateLayer: (id, changes) => editorRef.current?.updateLayer(id, changes),
        removeLayer: (id) => editorRef.current?.removeLayer(id),
        moveSelectionToLayer: (id) => editorRef.current?.moveSelectionToLayer(id),
    }));

    useEffect(() => {
        const container = containerRef.current!;
        const canvas = canvasRef.current!;
        const renderer = new PaperRenderer(canvas, overlayCanvasRef.current!);
        rendererRef.current = renderer;
        renderer.setViewport(viewportRef.current);
        renderer.setTheme(themeRef.current);
        renderer.setDocument(history.document);
        const grid = new GridLayer(container, settingsRef.current, themeRef.current, gridSettingsRef.current);
        grid.setViewport(viewportRef.current);
        gridRef.current = grid;
        // Created before the crosshair and the snap marker, so they lie above it
        const ucsIcon = new UcsIcon(container, settingsRef.current);
        ucsIcon.setViewport(viewportRef.current);
        ucsIconRef.current = ucsIcon;
        // Static: never told about the viewport or the size, so it never redraws
        const compass = new ViewCompass(container, settingsRef.current);
        compass.setVisible(gridSettingsRef.current.compass);
        compassRef.current = compass;
        // Under the own crosshair and the snap display, over the rest
        const remoteCursors = new RemoteCursors(container);
        remoteCursors.setViewport(viewportRef.current);
        remoteCursorsRef.current = remoteCursors;
        const remoteSelections = new RemoteSelections(container);
        remoteSelections.setViewport(viewportRef.current);
        remoteSelectionsRef.current = remoteSelections;
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
        // On top of everything: the one layer that takes the pointer
        const gripMenu = new GripMenu(container, (action) => editor.chooseGripAction(action));
        const overlay = new SelectionOverlay(renderer, settingsRef.current);
        overlay.setTheme(themeRef.current);
        overlayRef.current = overlay;
        editorRef.current = editor;

        /**
         * Where the cursor shows: on the snap point, the object snap tracking point, the polar
         * tracking point or the grip under it while the magnet holds it, else at the pointer.
         */
        const cursorAt = (viewPoint: Point): Point => {
            const { snap, objectTrack, polar, hoveredGrip } = editor.snapshot;
            const held = snap?.point ?? objectTrack?.point ?? polar?.point ?? hoveredGrip?.point;
            return held && settingsRef.current.snapMagnet ? viewportRef.current.modelToView(held) : viewPoint;
        };
        /** Pointer position while the crosshair shows, so it can follow snap and zoom changes. */
        let crosshairAt: Point | null = null;
        /**
         * The others see the crosshair where it shows (snap point and all), in model coordinates, and
         * nothing while it is hidden or while elements are selected or edited here: their name on
         * those elements says where this user is. The channel throttles and drops what nobody would hear.
         */
        const shareCursor = () => {
            const busy = editor.snapshot.highlighted.size > 0;
            presenceRef.current?.sendCursor(
                crosshairAt && !busy ? viewportRef.current.viewToModel(cursorAt(crosshairAt)) : null,
            );
        };
        /** What the room last got as the selection here, to skip the same set. */
        let shared: { to: PresenceChannel; ids: ReadonlySet<string> } | null = null;
        /** The others are told what is selected or edited here: the highlighted elements. */
        const shareSelection = () => {
            const to = presenceRef.current;
            const ids = editor.snapshot.highlighted;
            if (to && (shared?.to !== to || shared.ids !== ids)) {
                shared = { to, ids };
                to.sendSelection(ids);
            }
        };
        sharePresenceRef.current = () => {
            shareSelection();
            shareCursor();
        };
        /** The names over what the others selected, where those elements are now. */
        const nameSelections = () => {
            remoteSelections.set(
                selectionLabels(presenceRef.current?.getSelections() ?? [], (id) => renderer.getElementBounds(id)),
            );
        };
        /** What the others selected cannot be picked here, shows faintly and under their name. */
        const showSelections = () => {
            const ids = new Set((presenceRef.current?.getSelections() ?? []).flatMap((selection) => selection.ids));
            editor.setSelectedByOthers(ids);
            renderer.setSelectedByOthers(ids);
            nameSelections();
        };
        showSelectionsRef.current = showSelections;
        // After the renderer, whose paths give the places of the names
        const unsubscribeNames = history.subscribe(nameSelections);
        // What is done here (commands, undo, redo) goes to the others; what came from them does not go back
        const unsubscribeChanges = history.subscribe(({ before, document, changedElementIds, origin }) => {
            const to = presenceRef.current;
            if (origin !== null || !to) {
                return;
            }
            const patch = diffDocuments(before, document, changedElementIds);
            if (patch) {
                to.sendChange(patch);
            }
        });
        // A change of somebody else: no undo step here, and nothing if it does not fit this document
        applyChangeRef.current = (patch, userId) => {
            const change = applyDocumentPatch(history.document, patch);
            if (change) {
                history.applyRemote(change, userId);
            } else if (patch.planId === history.document.id) {
                console.warn('[collaboration] A change of another collaborator does not fit this drawing and was left out.');
            }
        };
        /**
         * Dynamic Input next to the crosshair: the prompt (or a typed command name) with the
         * prompts on, the fields at the crosshair or, for distance and angle from the prompt's
         * `from` point, on a dimension.
         */
        const refreshDynamicInput = () => {
            const { command, prompt, input, dynamicInput, from, previewValue } = editor.snapshot;
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
                dimension:
                    onDimension && from && point
                        ? // A typed negative angle turns clockwise
                          { from: view(from), to: view(point), clockwise: dynamicInput.format === 'angle' && (previewValue ?? 0) < 0 }
                        : null,
                bound: dynamicInput?.bound && point ? view(point) : null,
            });
        };
        const refreshOverlay = () => {
            const { snap, snapCycle, snapPreview, polar, acquired, objectTrack, from, preview, previewKeeps, previewPoint, cursor } =
                editor.snapshot;
            const { command, hotGrips, gripMenu: menu } = editor.snapshot;
            const viewport = viewportRef.current;
            gripMenu.show(menu && { at: viewport.modelToView(menu.grip.point), actions: menu.actions });
            // While moving, the originals show dimmed under the preview, like AutoCAD
            const basePoint = preview === 'move' ? from : null;
            // Likewise the elements a grip changes, under their preview
            const edited = typeof preview === 'object' && preview?.kind === 'elements' ? preview.ids : null;
            // Also from the last point while PLINIE measures a length, where KREIS, ELLIPSE or RECHTECK ask for one, and from a hot grip
            const rubberBand =
                typeof preview === 'object' &&
                preview !== null &&
                (preview.kind === 'polyline'
                    ? preview.direction !== undefined
                    : preview.kind === 'curve'
                      ? preview.rubberBand
                      : true);
            const rubberBandFrom = basePoint ?? (rubberBand ? from : null);
            // And the whole selection while a grip rotates, scales or mirrors it
            const transformed = typeof preview === 'object' && preview?.kind === 'transform';
            const dimmed = basePoint || transformed ? editor.snapshot.highlighted : (edited ?? NOTHING);
            // Not with a grip's option Copy, where the originals stay
            renderer.setDimmed(previewKeeps ? NOTHING : dimmed);
            // A grip's base point shows as a cross once it is not the hot grip itself
            const onGrip = from !== null && hotGrips.some(({ point }) => point.x === from.x && point.y === from.y);
            const marked = command === 'GRIP_EDIT' ? (onGrip ? null : from) : basePoint;
            overlay.render(editor.snapshot);
            snapMarker.showPreview(
                snapPreview.map(({ point, mode }) => ({ viewPoint: viewport.modelToView(point), mode })),
            );
            snapMarker.show(snap && { viewPoint: viewport.modelToView(snap.point), mode: snap.mode, cycle: snapCycle });
            snapMarker.showBasePoint(marked && viewport.modelToView(marked));
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
            crosshair.setBlocked(editor.snapshot.blocked);
            shareSelection();
            if (crosshairAt) {
                crosshair.moveTo(cursorAt(crosshairAt));
                shareCursor();
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
        const refreshTexts = () => {
            editor.refreshTexts();
            compass.refreshTexts();
        };
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
                    shareCursor();
                    refreshDynamicInput();
                },
                hide: () => {
                    crosshairAt = null;
                    crosshair.hide();
                    shareCursor();
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
            gripMenu.dispose();
            snapMarker.dispose();
            snapMarkerRef.current = null;
            grid.dispose();
            gridRef.current = null;
            ucsIcon.dispose();
            ucsIconRef.current = null;
            compass.dispose();
            compassRef.current = null;
            remoteCursors.dispose();
            remoteCursorsRef.current = null;
            unsubscribeNames();
            unsubscribeChanges();
            applyChangeRef.current = null;
            remoteSelections.dispose();
            remoteSelectionsRef.current = null;
            sharePresenceRef.current = null;
            showSelectionsRef.current = null;
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
    }, [history]);

    // After the effect above, so that the layer of the loaded document exists
    useEffect(() => {
        presenceRef.current = presence;
        const layer = remoteCursorsRef.current;
        if (!presence || !layer) {
            return;
        }
        const show = () => layer.set(presence.getCursors());
        const showSelections = () => showSelectionsRef.current?.();
        show();
        showSelections();
        // The pointer may be over the drawing already, and elements selected: tell the room
        sharePresenceRef.current?.();
        const unsubscribe = presence.subscribeCursors(show);
        const unsubscribeSelections = presence.subscribeSelections(showSelections);
        const unsubscribeChanges = presence.subscribeChanges((patch, userId) => applyChangeRef.current?.(patch, userId));
        return () => {
            unsubscribe();
            unsubscribeSelections();
            unsubscribeChanges();
            layer.set([]);
            // Nobody holds anything any more; nothing to do if the document went as well
            presenceRef.current = null;
            showSelectionsRef.current?.();
        };
    }, [presence, history]);

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

    // Only on its own switch (GridLayer.setGrid skips it as well)
    useEffect(() => {
        compassRef.current?.setVisible(gridSettings.compass);
    }, [gridSettings.compass]);

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
            <canvas ref={overlayCanvasRef} className="cad-overlay" />
        </div>
    );
}
