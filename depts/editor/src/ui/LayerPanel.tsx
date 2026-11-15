import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { DocumentHistory } from 'app/cad/editor/commands/DocumentHistory';
import type { AppearanceChanges } from 'app/cad/editor/commands/ElementAppearanceCommand';
import type { LayerChanges } from 'app/cad/editor/commands/LayerCommands';
import { floorLayers, layerElementCounts, layerNameError, MAX_LAYER_NAME_LENGTH, removeLayerBlocker } from 'app/cad/editor/layers';
import { commonAppearance } from 'app/cad/model/ElementAppearance';
import {
    isDefaultLayer,
    MAX_LAYER_DESCRIPTION_LENGTH,
    MAX_LAYER_TRANSPARENCY,
    type Layer,
    type Linetype,
    type Lineweight,
} from 'app/cad/model/Layer';
import type { Id } from 'app/cad/model/Point';
import { displayStrokeColor, type DisplayTheme } from 'app/cad/renderer/displayColor';
import { AddRow, ColorField, RowButton, SelectField, TextField } from './PanelFields';
import { useAppearanceOptions, usePlanDocument } from './panelHooks';

interface LayerPanelProps {
    /** The document with its changes: the panel shows the layers it holds now. */
    history: DocumentHistory;
    /** The layer new elements go on (SelectionSnapshot.currentLayerId). */
    currentLayerId: Id | null;
    /** A command runs: the layers cannot change, only the current one among the shown layers. */
    busy: boolean;
    /** The objects selected with no command running: a click on a layer puts them there. */
    selection: ReadonlySet<Id>;
    /** The colour fields show the layer colours as the drawing does. */
    theme: DisplayTheme;
    onSetCurrent: (id: Id) => void;
    onAdd: () => void;
    onUpdate: (id: Id, changes: LayerChanges) => void;
    onRemove: (id: Id) => void;
    onMoveSelection: (id: Id) => void;
    /** Sets what the selected objects override; null for the value of their style or layer again. */
    onSetAppearance: (changes: AppearanceChanges) => void;
    /** Gives the selected objects a style, or none with null. */
    onSetStyle: (styleId: Id | null) => void;
}

/** Value of the choice that stands for differing values; it cannot be chosen. */
const VARIES = '*';

const NO_LAYERS: ReadonlySet<Id> = new Set();

/**
 * The layer tab of the panel: on top the layers of the floor ending in the row that adds one, and
 * the properties of the current layer (scrolling on their own), below them what the selected objects
 * override (while there are any). A click on a layer makes it current, or, while objects
 * are selected, puts them on it like AutoCAD's layer list (the layers they are on are marked).
 * It only shows the document and asks for changes; the editor decides and makes them (one undo
 * step each).
 */
export function LayerPanel({
    history,
    currentLayerId,
    busy,
    selection,
    theme,
    onSetCurrent,
    onAdd,
    onUpdate,
    onRemove,
    onMoveSelection,
    onSetAppearance,
    onSetStyle,
}: LayerPanelProps) {
    const { t } = useTranslation();
    const document = usePlanDocument(history);
    const counts = useMemo(() => layerElementCounts(document), [document]);
    const { linetypes, lineweights } = useAppearanceOptions();
    const selected = useMemo(
        () => (selection.size === 0 ? [] : document.elements.filter((element) => selection.has(element.id))),
        [document, selection],
    );
    const selectionLayers = useMemo(() => (selected.length === 0 ? NO_LAYERS : new Set(selected.map((element) => element.layerId))), [selected]);
    const common = useMemo(() => commonAppearance(selected), [selected]);
    const commonStyle = selected.every((element) => element.styleId === selected[0]?.styleId) ? (selected[0]?.styleId ?? null) : undefined;
    // What an object does not set itself comes from its style first, where it has one
    const byLayer = t(selected.every((element) => element.styleId === null) ? 'properties.byLayer' : 'properties.byStyle');
    const varies = t('properties.varies');
    /** The choices of a property of the selection: ByLayer first, and "varies" while the objects differ. */
    const choices = (value: unknown, options: readonly { value: string; label: string }[]) => [
        ...(value === undefined ? [{ value: VARIES, label: varies, disabled: true }] : []),
        { value: '', label: byLayer },
        ...options,
    ];
    const chosen = (value: string | number | null | undefined) => (value === undefined ? VARIES : value === null ? '' : String(value));
    const current = document.layers.find((layer) => layer.id === currentLayerId);
    const floorId = current?.floorId ?? document.floors[0]?.id;
    const layers = floorId === undefined ? [] : floorLayers(document, floorId);

    return (
        <div className="panel-tab">
            <div className="panel-tab-main">
                <ul className="layer-list" aria-label={t('layers.list')}>
                    {layers.map((layer) => (
                        <LayerRow
                            key={layer.id}
                            layer={layer}
                            current={layer.id === currentLayerId}
                            busy={busy}
                            moving={selection.size > 0}
                            holdsSelection={selectionLayers.has(layer.id)}
                            color={displayStrokeColor(layer.color, theme)}
                            removeBlocker={removeLayerBlocker(document, layer.id, currentLayerId, counts)}
                            onSetCurrent={onSetCurrent}
                            onUpdate={onUpdate}
                            onRemove={onRemove}
                            onMoveSelection={onMoveSelection}
                        />
                    ))}
                    <AddRow label={t('layers.add')} disabled={busy} onClick={onAdd} />
                </ul>
                {current && (
                    <section className="panel-section" aria-label={t('layers.current')}>
                        <h3>{t('layers.current')}</h3>
                        <TextField
                            key={`name:${current.id}:${current.name}`}
                            label={t('layers.name')}
                            value={current.name}
                            disabled={busy || isDefaultLayer(current)}
                            maxLength={MAX_LAYER_NAME_LENGTH}
                            problem={(name) => {
                                const error = layerNameError(document, current.floorId, name, current.id);
                                return error === null ? null : t(`layers.nameError.${error}`, { max: MAX_LAYER_NAME_LENGTH });
                            }}
                            onCommit={(name) => onUpdate(current.id, { name })}
                        />
                        <ColorField
                            key={`color:${current.id}:${current.color}`}
                            label={t('layers.color')}
                            value={current.color}
                            shown={displayStrokeColor(current.color, theme)}
                            text={current.color}
                            disabled={busy}
                            onCommit={(color) => onUpdate(current.id, { color })}
                        />
                        <SelectField
                            label={t('layers.linetype')}
                            value={current.linetype}
                            options={linetypes}
                            disabled={busy}
                            onCommit={(linetype) => onUpdate(current.id, { linetype: linetype as Linetype })}
                        />
                        <SelectField
                            label={t('layers.lineweight')}
                            value={String(current.lineweight)}
                            options={lineweights}
                            disabled={busy}
                            onCommit={(lineweight) => onUpdate(current.id, { lineweight: Number(lineweight) as Lineweight })}
                        />
                        <TextField
                            key={`transparency:${current.id}:${current.transparency}`}
                            label={t('layers.transparency')}
                            title={t('layers.transparencyTitle', { max: MAX_LAYER_TRANSPARENCY })}
                            value={String(current.transparency)}
                            disabled={busy}
                            number={{ min: 0, max: MAX_LAYER_TRANSPARENCY }}
                            onCommit={(text) => {
                                const transparency = Number(text);
                                if (text.trim() !== '' && Number.isFinite(transparency)) {
                                    onUpdate(current.id, { transparency });
                                }
                            }}
                        />
                        <TextField
                            key={`description:${current.id}:${current.description}`}
                            label={t('layers.description')}
                            value={current.description}
                            disabled={busy}
                            maxLength={MAX_LAYER_DESCRIPTION_LENGTH}
                            onCommit={(description) => onUpdate(current.id, { description })}
                        />
                    </section>
                )}
            </div>
            {selected.length > 0 && (
                <section className="panel-section panel-tab-footer" aria-label={t('properties.title')}>
                    <div className="panel-element-title">
                        <h3>{t('properties.title')}</h3>
                        <p className="panel-note">{t('properties.count', { count: selected.length })}</p>
                    </div>
                    <SelectField
                        label={t('properties.style')}
                        value={chosen(commonStyle)}
                        options={[
                            ...(commonStyle === undefined ? [{ value: VARIES, label: varies, disabled: true }] : []),
                            { value: '', label: t('styles.none') },
                            ...document.styles.map((style) => ({ value: style.id, label: style.name })),
                        ]}
                        disabled={busy}
                        onCommit={(styleId) => onSetStyle(styleId === '' ? null : styleId)}
                    />
                    <ColorField
                        key={`selection-color:${common.color}`}
                        label={t('layers.color')}
                        value={common.color ?? '#000000'}
                        shown={common.color ? displayStrokeColor(common.color, theme) : null}
                        text={common.color === undefined ? varies : (common.color ?? byLayer)}
                        disabled={busy}
                        onCommit={(color) => onSetAppearance({ color })}
                        reset={common.color === null ? undefined : { label: t('properties.reset', { property: t('layers.color') }), onClick: () => onSetAppearance({ color: null }) }}
                    />
                    <SelectField
                        label={t('layers.linetype')}
                        value={chosen(common.linetype)}
                        options={choices(common.linetype, linetypes)}
                        disabled={busy}
                        onCommit={(linetype) => onSetAppearance({ linetype: linetype === '' ? null : (linetype as Linetype) })}
                    />
                    <SelectField
                        label={t('layers.lineweight')}
                        value={chosen(common.lineweight)}
                        options={choices(common.lineweight, lineweights)}
                        disabled={busy}
                        onCommit={(lineweight) => onSetAppearance({ lineweight: lineweight === '' ? null : (Number(lineweight) as Lineweight) })}
                    />
                    <TextField
                        key={`selection-transparency:${common.transparency}`}
                        label={t('layers.transparency')}
                        title={t('layers.transparencyTitle', { max: MAX_LAYER_TRANSPARENCY })}
                        value={common.transparency == null ? '' : String(common.transparency)}
                        placeholder={common.transparency === undefined ? varies : byLayer}
                        disabled={busy}
                        number={{ min: 0, max: MAX_LAYER_TRANSPARENCY }}
                        onCommit={(text) => {
                            const transparency = Number(text);
                            if (text.trim() === '') {
                                onSetAppearance({ transparency: null });
                            } else if (Number.isFinite(transparency)) {
                                onSetAppearance({ transparency });
                            }
                        }}
                    />
                </section>
            )}
        </div>
    );
}

interface LayerRowProps {
    layer: Layer;
    current: boolean;
    busy: boolean;
    /** Objects are selected: a click puts them on this layer instead of making it current. */
    moving: boolean;
    /** Selected objects are on this layer. */
    holdsSelection: boolean;
    /** The layer colour as the drawing shows it. */
    color: string;
    removeBlocker: ReturnType<typeof removeLayerBlocker>;
    onSetCurrent: (id: Id) => void;
    onUpdate: (id: Id, changes: LayerChanges) => void;
    onRemove: (id: Id) => void;
    onMoveSelection: (id: Id) => void;
}

/**
 * A layer of the list: a click on it makes it current, or puts the selected objects on it;
 * beside it its switches and the delete button.
 */
function LayerRow({ layer, current, busy, moving, holdsSelection, color, removeBlocker, onSetCurrent, onUpdate, onRemove, onMoveSelection }: LayerRowProps) {
    const { t } = useTranslation();
    const { id, name } = layer;
    return (
        <li className="layer-row" data-current={current} data-hidden={!layer.visible} data-selection={holdsSelection}>
            <button
                type="button"
                className="layer-row-main"
                aria-current={current ? 'true' : undefined}
                // Showing a hidden layer changes the document
                disabled={busy && !layer.visible}
                title={t(moving ? 'layers.moveSelection' : 'layers.makeCurrent', { name })}
                onClick={() => (moving ? onMoveSelection(id) : onSetCurrent(id))}
            >
                <span className="layer-swatch" style={{ background: color }} />
                <span className="layer-row-name">{name}</span>
            </button>
            <RowButton
                icon={layer.visible ? 'eye' : 'eyeOff'}
                label={t(layer.visible ? 'layers.hide' : 'layers.show', { name })}
                pressed={layer.visible}
                disabled={busy}
                blocked={current && layer.visible ? t('layers.currentStaysVisible') : null}
                onClick={() => onUpdate(id, { visible: !layer.visible })}
            />
            <RowButton
                icon={layer.locked ? 'lock' : 'unlock'}
                label={t(layer.locked ? 'layers.unlock' : 'layers.lock', { name })}
                pressed={layer.locked}
                alert={layer.locked}
                disabled={busy}
                blocked={null}
                onClick={() => onUpdate(id, { locked: !layer.locked })}
            />
            <RowButton
                icon="trash"
                label={t('layers.remove')}
                disabled={busy}
                blocked={removeBlocker === null ? null : t(`layers.removeBlocked.${removeBlocker}`)}
                onClick={() => onRemove(id)}
            />
        </li>
    );
}
