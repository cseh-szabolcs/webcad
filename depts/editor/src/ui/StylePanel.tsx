import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DocumentHistory } from 'app/cad/editor/commands/DocumentHistory';
import type { StyleChanges } from 'app/cad/editor/commands/StyleCommands';
import { MAX_STYLE_NAME_LENGTH, styleElementCounts, styleNameError } from 'app/cad/editor/styles';
import { MAX_LAYER_TRANSPARENCY, type Linetype, type Lineweight } from 'app/cad/model/Layer';
import type { Id } from 'app/cad/model/Point';
import { displayFillColor, displayStrokeColor, type DisplayTheme } from 'app/cad/renderer/displayColor';
import { AddRow, ColorField, RowButton, SelectField, TextField } from './PanelFields';
import { useAppearanceOptions, usePlanDocument } from './panelHooks';

interface StylePanelProps {
    /** The document with its changes: the tab shows the styles it holds now. */
    history: DocumentHistory;
    /** A command runs: the styles cannot change. */
    busy: boolean;
    theme: DisplayTheme;
    /** Adds a style and returns its id, or null where it could not. */
    onAdd: () => Id | null;
    onUpdate: (id: Id, changes: StyleChanges) => void;
    onRemove: (id: Id) => void;
}

/**
 * The style tab of the panel, the styles of the plan: the list (a click on one shows its properties below) ending in the row that
 * adds one, and the properties of the chosen style. A value a style does not set is left to the
 * layer ("VonLayer"). It only shows the document and asks for changes, like the layer panel.
 */
export function StylePanel({ history, busy, theme, onAdd, onUpdate, onRemove }: StylePanelProps) {
    const { t } = useTranslation();
    const document = usePlanDocument(history);
    const { linetypes, lineweights } = useAppearanceOptions();
    /** The style whose properties show; none until one is chosen, and again once it is gone. */
    const [editedId, setEditedId] = useState<Id | null>(null);
    const edited = document.styles.find((style) => style.id === editedId);
    const counts = useMemo(() => styleElementCounts(document), [document]);
    const byLayer = t('properties.byLayer');
    const withByLayer = (options: readonly { value: string; label: string }[]) => [{ value: '', label: byLayer }, ...options];

    return (
        <div className="panel-tab">
            <div className="panel-tab-main">
                <ul className="layer-list" aria-label={t('styles.list')}>
                    {document.styles.map((style) => {
                        const shown = style.color ? displayStrokeColor(style.color, theme) : style.fillColor ? displayFillColor(style.fillColor, theme) : null;
                        return (
                            <li key={style.id} className="layer-row" data-current={style.id === editedId}>
                                <button
                                    type="button"
                                    className="layer-row-main"
                                    aria-current={style.id === editedId ? 'true' : undefined}
                                    title={t('styles.edit', { name: style.name })}
                                    onClick={() => setEditedId(style.id === editedId ? null : style.id)}
                                >
                                    <span className="layer-swatch" data-empty={shown === null} style={shown === null ? undefined : { background: shown }} />
                                    <span className="layer-row-name">{style.name}</span>
                                    <span className="layer-row-count">{counts.get(style.id) ?? 0}</span>
                                </button>
                                <RowButton icon="trash" label={t('styles.remove', { name: style.name })} disabled={busy} blocked={null} onClick={() => onRemove(style.id)} />
                            </li>
                        );
                    })}
                    <AddRow
                        label={t('styles.add')}
                        disabled={busy}
                        onClick={() => {
                            const id = onAdd();
                            if (id !== null) {
                                setEditedId(id);
                            }
                        }}
                    />
                </ul>
                {edited && (
                    <section className="panel-section" aria-label={t('styles.selected', { name: edited.name })}>
                        <TextField
                            key={`name:${edited.id}:${edited.name}`}
                            label={t('layers.name')}
                            value={edited.name}
                            disabled={busy}
                            maxLength={MAX_STYLE_NAME_LENGTH}
                            problem={(name) => {
                                const error = styleNameError(document, name, edited.id);
                                return error === null ? null : t(`styles.nameError.${error}`, { max: MAX_STYLE_NAME_LENGTH });
                            }}
                            onCommit={(name) => onUpdate(edited.id, { name })}
                        />
                        <ColorField
                            key={`color:${edited.id}:${edited.color}`}
                            label={t('layers.color')}
                            value={edited.color ?? '#000000'}
                            shown={edited.color ? displayStrokeColor(edited.color, theme) : null}
                            text={edited.color ?? byLayer}
                            disabled={busy}
                            onCommit={(color) => onUpdate(edited.id, { color })}
                            reset={edited.color === null ? undefined : { label: t('properties.reset', { property: t('layers.color') }), onClick: () => onUpdate(edited.id, { color: null }) }}
                        />
                        <SelectField
                            label={t('layers.linetype')}
                            value={edited.linetype ?? ''}
                            options={withByLayer(linetypes)}
                            disabled={busy}
                            onCommit={(linetype) => onUpdate(edited.id, { linetype: linetype === '' ? null : (linetype as Linetype) })}
                        />
                        <SelectField
                            label={t('layers.lineweight')}
                            value={edited.lineweight === null ? '' : String(edited.lineweight)}
                            options={withByLayer(lineweights)}
                            disabled={busy}
                            onCommit={(lineweight) => onUpdate(edited.id, { lineweight: lineweight === '' ? null : (Number(lineweight) as Lineweight) })}
                        />
                        <TextField
                            key={`transparency:${edited.id}:${edited.transparency}`}
                            label={t('layers.transparency')}
                            title={t('layers.transparencyTitle', { max: MAX_LAYER_TRANSPARENCY })}
                            value={edited.transparency === null ? '' : String(edited.transparency)}
                            placeholder={byLayer}
                            disabled={busy}
                            number={{ min: 0, max: MAX_LAYER_TRANSPARENCY }}
                            onCommit={(text) => {
                                const transparency = Number(text);
                                if (text.trim() === '') {
                                    onUpdate(edited.id, { transparency: null });
                                } else if (Number.isFinite(transparency)) {
                                    onUpdate(edited.id, { transparency });
                                }
                            }}
                        />
                        <ColorField
                            key={`fill:${edited.id}:${edited.fillColor}`}
                            label={t('styles.fill')}
                            value={edited.fillColor ?? '#ffffff'}
                            shown={edited.fillColor ? displayFillColor(edited.fillColor, theme) : null}
                            text={edited.fillColor ?? t('styles.noFill')}
                            disabled={busy}
                            onCommit={(fillColor) => onUpdate(edited.id, { fillColor })}
                            reset={edited.fillColor === null ? undefined : { label: t('styles.removeFill'), onClick: () => onUpdate(edited.id, { fillColor: null }) }}
                        />
                    </section>
                )}
            </div>
        </div>
    );
}
