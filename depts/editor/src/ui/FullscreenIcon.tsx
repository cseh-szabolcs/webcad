/** Paths of the usual icons in a 24×24 box: corners pointing outwards resp. inwards. */
const ENTER_PATH = 'M3 8V3h5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5';
const EXIT_PATH = 'M8 3v5H3 M21 8h-5V3 M16 21v-5h5 M3 16h5v5';

/** Icon of the fullscreen button, drawn in the text colour like the theme icons. */
export function FullscreenIcon({ active }: { active: boolean }) {
    return (
        <svg className="theme-icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d={active ? EXIT_PATH : ENTER_PATH} />
        </svg>
    );
}
