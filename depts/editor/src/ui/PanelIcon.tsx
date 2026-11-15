/** Paths in a 24×24 box, drawn like the tool icons. */
const PATHS = {
    layers: 'M12 3.5l9 4.5l-9 4.5l-9-4.5z M3 12l9 4.5l9-4.5 M3 16l9 4.5l9-4.5',
    eye: 'M2.5 12s3.5-6 9.5-6s9.5 6 9.5 6s-3.5 6-9.5 6s-9.5-6-9.5-6z M14.75 12a2.75 2.75 0 1 1-5.5 0a2.75 2.75 0 1 1 5.5 0z',
    eyeOff: 'M2.5 12s3.5-6 9.5-6s9.5 6 9.5 6s-3.5 6-9.5 6s-9.5-6-9.5-6z M4.5 4.5l15 15',
    lock: 'M6 11h12v9H6z M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
    unlock: 'M6 11h12v9H6z M8.5 11V7.5a3.5 3.5 0 0 1 6.7-1.4',
    trash: 'M4 6.5h16 M9.5 6.5V4h5v2.5 M6 6.5l1 14h10l1-14 M10 10.5v6.5 M14 10.5v6.5',
    plus: 'M12 5v14 M5 12h14',
    close: 'M6 6l12 12 M18 6L6 18',
    chevronLeft: 'M14.5 6l-6 6l6 6',
    chevronRight: 'M9.5 6l6 6l-6 6',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    reset: 'M4 9h10a5 5 0 0 1 0 10H9 M8 5L4 9l4 4',
} as const;

export type PanelIconName = keyof typeof PATHS;

/** Icon of a panel's buttons and of the layer button, in the text colour. */
export function PanelIcon({ name, size = 16 }: { name: PanelIconName; size?: number }) {
    return (
        <svg className="tool-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <path d={PATHS[name]} />
        </svg>
    );
}
