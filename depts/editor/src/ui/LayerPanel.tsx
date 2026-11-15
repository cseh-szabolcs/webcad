import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { DocumentHistory } from 'app/cad/editor/commands/DocumentHistory';
import type { LayerChanges } from 'app/cad/editor/commands/LayerCommands';
import { floorLayers, layerElementCounts, layerNameError, MAX_LAYER_NAME_LENGTH, removeLayerBlocker } from 'app/cad/editor/layers';
import { isDefaultLayer, LINETYPES, MAX_LAYER_DESCRIPTION_LENGTH, MAX_LAYER_TRANSPARENCY, type Layer, type Linetype } from 'app/cad/model/Layer';
import type { Id } from 'app/cad/model/Point';
import { displayStrokeColor, type DisplayTheme } from 'app/cad/renderer/displayColor';
import { PanelIcon, type PanelIconName } from './PanelIcon';

interface LayerPanelProps {
    /** The document with its changes: the panel shows the layers it holds now. */
    history: DocumentHistory;
    /** The layer new elements go on (SelectionSnapshot.currentLayerId). */
    currentLayerId: Id | null;
    /** A command runs: the layers cannot change, only the current one among the shown layers. */
    busy: boolean;
    /** The colour fields show the layer colours as the drawing does. */
    theme: DisplayTheme;
    onSetCurrent: (id: Id) => void;
    onAdd: () => void;
    onUpdate: (id: Id, changes: LayerChanges) => void;
    onRemove: (id: Id) => void;
}

/**
 * Content of the layer panel: the properties of the current layer, the button that adds a layer,
 * and the layers of the floor to go through (a click makes one current). It only shows the
 * document and asks for changes; the editor decides and makes them (one undo step each).
 */
export function LayerPanel({ history, currentLayerId, busy, theme, onSetCurrent, onAdd, onUpdate, onRemove }: LayerPanelProps) {
    const { t } = useTranslation();
    const document = useSyncExternalStore(
        useCallback((listener: () => void) => history.subscribe(listener), [history]),
        () => history.document,
    );
    const counts = useMemo(() => layerElementCounts(document), [document]);
    const current = document.layers.find((layer) => layer.id === currentLayerId);
    const floorId = current?.floorId ?? document.floors[0]?.id;
    const layers = floorId === undefined ? [] : floorLayers(document, floorId);

    return (
        <>
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
                        disabled={busy}
                        onCommit={(color) => onUpdate(current.id, { color })}
                    />
                    <LinetypeField
                        label={t('layers.linetype')}
                        value={current.linetype}
                        disabled={busy}
                        onCommit={(linetype) => onUpdate(current.id, { linetype })}
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
            <button type="button" className="panel-add-button" disabled={busy} onClick={onAdd}>
                <PanelIcon name="plus" />
                {t('layers.add')}
            </button>
            <ul className="layer-list" aria-label={t('layers.list')}>
                {layers.map((layer) => (
                    <LayerRow
                        key={layer.id}
                        layer={layer}
                        current={layer.id === currentLayerId}
                        busy={busy}
                        color={displayStrokeColor(layer.color, theme)}
                        removeBlocker={removeLayerBlocker(document, layer.id, currentLayerId, counts)}
                        onSetCurrent={onSetCurrent}
                        onUpdate={onUpdate}
                        onRemove={onRemove}
                    />
                ))}
            </ul>
        </>
    );
}

interface LayerRowProps {
    layer: Layer;
    current: boolean;
    busy: boolean;
    /** The layer colour as the drawing shows it. */
    color: string;
    removeBlocker: ReturnType<typeof removeLayerBlocker>;
    onSetCurrent: (id: Id) => void;
    onUpdate: (id: Id, changes: LayerChanges) => void;
    onRemove: (id: Id) => void;
}

/** A layer of the list: a click on it makes it current; beside it its switches and the delete button. */
function LayerRow({ layer, current, busy, color, removeBlocker, onSetCurrent, onUpdate, onRemove }: LayerRowProps) {
    const { t } = useTranslation();
    const { id, name } = layer;
    return (
        <li className="layer-row" data-current={current} data-hidden={!layer.visible}>
            <button
                type="button"
                className="layer-row-main"
                aria-current={current ? 'true' : undefined}
                // Showing a hidden layer changes the document
                disabled={busy && !layer.visible}
                title={t('layers.makeCurrent', { name })}
                onClick={() => onSetCurrent(id)}
            >
                <span className="layer-row-marker">{current && <PanelIcon name="check" size={14} />}</span>
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

/**
 * An icon button of a layer row. With `blocked` (the reason) it does nothing but still shows its
 * tooltip, hence aria-disabled rather than disabled.
 */
function RowButton({
    icon,
    label,
    pressed,
    disabled,
    blocked,
    onClick,
}: {
    icon: PanelIconName;
    label: string;
    pressed?: boolean;
    disabled: boolean;
    blocked: string | null;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            className="panel-icon-button"
            aria-label={label}
            aria-pressed={pressed}
            aria-disabled={blocked !== null}
            disabled={disabled}
            title={blocked ?? label}
            onClick={() => blocked === null && onClick()}
        >
            <PanelIcon name={icon} />
        </button>
    );
}

interface TextFieldProps {
    label: string;
    title?: string;
    /** The value in the document; the field starts with it (give the field a key that changes with it). */
    value: string;
    disabled: boolean;
    maxLength?: number;
    /** A number field with these limits. */
    number?: { min: number; max: number };
    /** What is wrong with the typed text, shown below the field; such a text is never committed. */
    problem?: (text: string) => string | null;
    onCommit: (text: string) => void;
}

/**
 * A field that commits what was typed when it is left or on Enter, as one change, and puts the
 * value back on Esc. It then shows the value again: the new one arrives with the document.
 */
function TextField({ label, title, value, disabled, maxLength, number, problem, onCommit }: TextFieldProps) {
    const id = useId();
    const [error, setError] = useState<string | null>(null);
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && error === null) {
            event.currentTarget.blur();
        } else if (event.key === 'Escape') {
            event.currentTarget.value = value;
            setError(null);
            event.currentTarget.blur();
        }
    };
    return (
        <div className="panel-field" title={title}>
            <label htmlFor={id}>{label}</label>
            <input
                id={id}
                type={number ? 'number' : 'text'}
                min={number?.min}
                max={number?.max}
                step={number ? 1 : undefined}
                defaultValue={value}
                disabled={disabled}
                maxLength={maxLength}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={error !== null}
                aria-describedby={error !== null ? `${id}-error` : undefined}
                onChange={(event) => setError(problem?.(event.currentTarget.value) ?? null)}
                onKeyDown={onKeyDown}
                onBlur={(event) => {
                    const text = event.currentTarget.value;
                    event.currentTarget.value = value;
                    setError(null);
                    if (text !== value && (problem?.(text) ?? null) === null) {
                        onCommit(text);
                    }
                }}
            />
            {error !== null && (
                <p id={`${id}-error`} className="panel-field-error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}

/**
 * The browser's colour picker. It commits when the picker closes (the native `change` event;
 * React's onChange fires for every colour passed over), so choosing a colour is one change.
 */
function ColorField({
    label,
    value,
    shown,
    disabled,
    onCommit,
}: {
    label: string;
    value: string;
    /** The colour as the drawing shows it, which differs from the stored one on a dark background. */
    shown: string;
    disabled: boolean;
    onCommit: (color: string) => void;
}) {
    const id = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const commitRef = useRef(onCommit);
    useEffect(() => {
        commitRef.current = onCommit;
    });
    useEffect(() => {
        const input = inputRef.current!;
        const commit = () => commitRef.current(input.value);
        input.addEventListener('change', commit);
        return () => input.removeEventListener('change', commit);
    }, []);
    return (
        <div className="panel-field">
            <label htmlFor={id}>{label}</label>
            <span className="panel-color">
                <input ref={inputRef} id={id} type="color" defaultValue={value} disabled={disabled} />
                <span className="layer-swatch" style={{ background: shown }} />
                <code>{value}</code>
            </span>
        </div>
    );
}

function LinetypeField({ label, value, disabled, onCommit }: { label: string; value: Linetype; disabled: boolean; onCommit: (linetype: Linetype) => void }) {
    const { t } = useTranslation();
    const id = useId();
    return (
        <div className="panel-field">
            <label htmlFor={id}>{label}</label>
            <select
                id={id}
                value={value}
                disabled={disabled}
                onChange={(event) => {
                    onCommit(event.currentTarget.value as Linetype);
                    // The keys go to the editor again
                    event.currentTarget.blur();
                }}
            >
                {LINETYPES.map((linetype) => (
                    <option key={linetype} value={linetype}>
                        {t(`layers.linetypes.${linetype}`)}
                    </option>
                ))}
            </select>
        </div>
    );
}
