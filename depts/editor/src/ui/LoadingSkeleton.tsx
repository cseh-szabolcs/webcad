/**
 * Placeholder while the plan loads: the editor's frame (toolbar, tool panel, canvas, right column,
 * status bar) as shimmering blocks, a plain made-up floor plan filling the canvas, and over it the
 * loading text with a bar that only moves (it shows no real progress).
 */
export function LoadingSkeleton({ label, sidePanelWidth }: { label: string; sidePanelWidth: number | null }) {
    return (
        <div className="app skeleton" aria-busy="true">
            <div className="toolbar skeleton-row" aria-hidden="true">
                <Block width={68} />
                <Block width={84} />
                <Block width={150} />
                <Block width={64} round />
                <Block width={92} />
                <div className="skeleton-row skeleton-end">
                    <Block width={86} />
                    <Block width={44} />
                    <Block width={58} />
                    <Block width={26} />
                </div>
            </div>
            <div className="tool-panel skeleton-row" aria-hidden="true">
                {[4, 6, 3].map((count, group) => (
                    <div key={group} className="tool-panel-group">
                        {Array.from({ length: count }, (_, i) => (
                            <Block key={i} width={32} height={32} />
                        ))}
                    </div>
                ))}
                <div className="tool-panel-end">
                    <Block width={32} height={32} />
                </div>
            </div>
            <div className="workspace">
                <div className="skeleton-canvas">
                    {/* Landscape, like most screens: three rooms above, two and a stair below */}
                    <svg className="skeleton-plan" viewBox="0 0 400 240" aria-hidden="true">
                        <path className="skeleton-wall" d="M20 20H380V220H20Z" />
                        <path d="M20 120H130M160 120H190M190 20V90M190 120V220M250 120H380M290 20V120M290 150V220" />
                        <path className="skeleton-door" d="M130 120A30 30 0 0 1 160 90M190 90A30 30 0 0 1 220 120" />
                        <rect x="210" y="40" width="60" height="40" rx="3" />
                        <circle cx="80" cy="175" r="22" />
                        <path d="M310 140h50v66h-50zM310 156h50M310 173h50M310 190h50" />
                    </svg>
                    <div className="skeleton-status" role="status">
                        <p className="skeleton-label">{label}</p>
                        <div className="skeleton-progress" aria-hidden="true">
                            <span />
                        </div>
                    </div>
                </div>
                {sidePanelWidth !== null && (
                    <div className="skeleton-side" style={{ width: sidePanelWidth }} aria-hidden="true">
                        <div className="skeleton-row skeleton-side-tabs">
                            <Block width={58} />
                            <Block width={52} />
                        </div>
                        {[70, 54, 82, 46, 64].map((width, i) => (
                            <div key={i} className="skeleton-row skeleton-side-row">
                                <Block width={14} height={14} round />
                                <Block width={`${width}%`} height={12} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="statusbar skeleton-row" aria-hidden="true">
                {[42, 48, 54, 44, 120].map((width, i) => (
                    <Block key={i} width={width} height={14} />
                ))}
            </div>
        </div>
    );
}

function Block({ width, height = 24, round = false }: { width: number | string; height?: number; round?: boolean }) {
    return <span className={round ? 'skeleton-block skeleton-round' : 'skeleton-block'} style={{ width, height }} />;
}
