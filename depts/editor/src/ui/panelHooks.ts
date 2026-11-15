import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { DocumentHistory } from 'app/cad/editor/commands/DocumentHistory';
import { LINETYPES, LINEWEIGHTS } from 'app/cad/model/Layer';
import { currentLanguage } from 'app/i18n/i18n';

/** The document of the history as it is now, following its changes. */
export function usePlanDocument(history: DocumentHistory) {
    return useSyncExternalStore(
        useCallback((listener: () => void) => history.subscribe(listener), [history]),
        () => history.document,
    );
}

/** The choices of a linetype and of a lineweight, as the fields of layers, styles and the selection offer them. */
export function useAppearanceOptions() {
    const { t } = useTranslation();
    // Lineweights as AutoCAD lists them: 0.25 mm, in German 0,25 mm
    const language = currentLanguage();
    return useMemo(() => {
        const millimetres = new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return {
            linetypes: LINETYPES.map((linetype) => ({ value: linetype as string, label: t(`layers.linetypes.${linetype}`) })),
            lineweights: LINEWEIGHTS.map((lineweight) => ({
                value: String(lineweight),
                label: t('layers.lineweightValue', { value: millimetres.format(lineweight / 100) }),
            })),
        };
    }, [language, t]);
}
