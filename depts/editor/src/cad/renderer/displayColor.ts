/** Background the drawing is shown on. Only affects display, never the stored colours. */
export type DisplayTheme = 'light' | 'dark';

/** Canvas background in dark mode; keep in sync with `--canvas-bg` in index.css. */
const DARK_CANVAS_BG = '#212830';

/**
 * Lowest lightness of a stroke on the dark background, so mid tones (e.g. a medium blue,
 * mirrored to about 0.47) stand out clearly from the background and from fills.
 */
const DARK_STROKE_MIN_LIGHTNESS = 0.6;

/**
 * Colour to draw a stored stroke colour with. Styles are defined for a light background;
 * on a dark one the lightness is mirrored (HSL: L → 1 − L) and hue and saturation stay, so
 * near black becomes near white; darker results are lifted to a minimum lightness.
 * Supports `#rgb`, `#rrggbb` and the same with alpha; other notations are returned
 * unchanged.
 */
export function displayStrokeColor(color: string, theme: DisplayTheme): string {
    return theme === 'light' ? color : mirrorLightness(color, DARK_STROKE_MIN_LIGHTNESS);
}

/**
 * Colour to draw a stored fill colour with. On the dark background a fill keeps the look it
 * has on white: it lies as far above the background's lightness as it lies below white,
 * and it keeps its chroma (colourfulness) rather than its HSL saturation, which would turn
 * a pale tint into a loud deep colour. So a pale blue tint stays a subtle tint, and a white
 * fill matches the background, as it does on white.
 */
export function displayFillColor(color: string, theme: DisplayTheme): string {
    if (theme === 'light') {
        return color;
    }
    const rgba = parseHex(color);
    if (!rgba) {
        return color;
    }
    const [h, s, l] = rgbToHsl(rgba[0], rgba[1], rgba[2]);
    const chroma = (1 - Math.abs(2 * l - 1)) * s;
    const lightness = Math.min(DARK_BACKGROUND_LIGHTNESS + (1 - l), 1);
    const maxChroma = 1 - Math.abs(2 * lightness - 1);
    const saturation = maxChroma === 0 ? 0 : Math.min(chroma / maxChroma, 1);
    const [r, g, b] = hslToRgb(h, saturation, lightness);
    return toHex([r, g, b]) + (rgba[3] === null ? '' : hexByte(rgba[3]));
}

function mirrorLightness(color: string, minLightness: number): string {
    const rgba = parseHex(color);
    if (!rgba) {
        return color;
    }
    const [h, s, l] = rgbToHsl(rgba[0], rgba[1], rgba[2]);
    const [r, g, b] = hslToRgb(h, s, Math.max(1 - l, minLightness));
    return toHex([r, g, b]) + (rgba[3] === null ? '' : hexByte(rgba[3]));
}

/** [r, g, b, alpha or null], each 0–255. */
function parseHex(color: string): [number, number, number, number | null] | null {
    const match = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color.trim());
    if (!match) {
        return null;
    }
    let hex = match[1];
    if (hex.length <= 4) {
        hex = [...hex].map((digit) => digit + digit).join('');
    }
    const bytes = hex.match(/../g)!.map((pair) => parseInt(pair, 16));
    return [bytes[0], bytes[1], bytes[2], bytes.length === 4 ? bytes[3] : null];
}

/** h in [0, 360), s and l in [0, 1]. */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    const [rn, gn, bn] = [r / 255, g / 255, b / 255];
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) {
        return [0, 0, l];
    }
    const s = d / (1 - Math.abs(2 * l - 1));
    let h: number;
    if (max === rn) {
        h = ((gn - bn) / d) % 6;
    } else if (max === gn) {
        h = (bn - rn) / d + 2;
    } else {
        h = (rn - gn) / d + 4;
    }
    return [(h * 60 + 360) % 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, g, b] =
        h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function toHex(channels: number[]): string {
    return '#' + channels.map(hexByte).join('');
}

function hexByte(value: number): string {
    return Math.round(Math.min(Math.max(value, 0), 255))
        .toString(16)
        .padStart(2, '0');
}

const DARK_BACKGROUND_LIGHTNESS = (() => {
    const [r, g, b] = parseHex(DARK_CANVAS_BG)!;
    return rgbToHsl(r, g, b)[2];
})();
