/**
 * Extra wait in ms before the loaded plan replaces the skeleton, to look at it: `data-loading-delay`
 * on `#root` (the Symfony page, EDITOR_LOADING_DELAY_MS), else `VITE_LOADING_DELAY_MS`, else 0.
 */
export function loadingDelay(root: HTMLElement | null = document.getElementById('root')): number {
    const value = Number(root?.dataset.loadingDelay || import.meta.env.VITE_LOADING_DELAY_MS || 0);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}
