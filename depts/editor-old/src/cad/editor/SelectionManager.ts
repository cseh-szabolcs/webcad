import type { CadDocument } from '../model/CadDocument';
import type { Id } from '../model/Point';

/** Selection and hover state. Never persisted. */
export class SelectionManager {
    private selectedIds: ReadonlySet<Id> = new Set();
    private hoveredIds: ReadonlySet<Id> = new Set();
    private readonly listeners = new Set<() => void>();

    get selected(): ReadonlySet<Id> {
        return this.selectedIds;
    }

    /** Elements a click would select, highlighted while the pointer is over them. */
    get hovered(): ReadonlySet<Id> {
        return this.hoveredIds;
    }

    select(ids: Iterable<Id>): void {
        this.setSelected(new Set(ids));
    }

    toggle(id: Id): void {
        const next = new Set(this.selectedIds);
        if (!next.delete(id)) {
            next.add(id);
        }
        this.setSelected(next);
    }

    clear(): void {
        this.setSelected(new Set());
    }

    setHovered(ids: Iterable<Id>): void {
        const next = new Set(ids);
        if (!sameIds(next, this.hoveredIds)) {
            this.hoveredIds = next;
            this.notify();
        }
    }

    /** Drops ids of elements that no longer exist. */
    prune(doc: CadDocument): void {
        const existing = new Set(doc.elements.map((element) => element.id));
        const keptHovered = [...this.hoveredIds].filter((id) => existing.has(id));
        const hoveredGone = keptHovered.length !== this.hoveredIds.size;
        if (hoveredGone) {
            this.hoveredIds = new Set(keptHovered);
        }
        const kept = [...this.selectedIds].filter((id) => existing.has(id));
        if (kept.length !== this.selectedIds.size) {
            this.selectedIds = new Set(kept);
            this.notify();
        } else if (hoveredGone) {
            this.notify();
        }
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private setSelected(next: ReadonlySet<Id>): void {
        if (sameIds(next, this.selectedIds)) {
            return;
        }
        this.selectedIds = next;
        this.notify();
    }

    private notify(): void {
        this.listeners.forEach((listener) => listener());
    }
}

function sameIds(a: ReadonlySet<Id>, b: ReadonlySet<Id>): boolean {
    return a.size === b.size && [...a].every((id) => b.has(id));
}
