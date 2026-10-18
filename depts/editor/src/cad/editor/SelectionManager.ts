import type { CadDocument } from '../model/CadDocument';
import type { Id } from '../model/Point';

/** Selection and hover state. Never persisted. */
export class SelectionManager {
    private selectedIds: ReadonlySet<Id> = new Set();
    private hoveredId: Id | null = null;
    private readonly listeners = new Set<() => void>();

    get selected(): ReadonlySet<Id> {
        return this.selectedIds;
    }

    get hovered(): Id | null {
        return this.hoveredId;
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

    setHovered(id: Id | null): void {
        if (id !== this.hoveredId) {
            this.hoveredId = id;
            this.notify();
        }
    }

    /** Drops ids of elements that no longer exist. */
    prune(doc: CadDocument): void {
        const existing = new Set(doc.elements.map((element) => element.id));
        const hoveredGone = this.hoveredId !== null && !existing.has(this.hoveredId);
        if (hoveredGone) {
            this.hoveredId = null;
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
        if (next.size === this.selectedIds.size && [...next].every((id) => this.selectedIds.has(id))) {
            return;
        }
        this.selectedIds = next;
        this.notify();
    }

    private notify(): void {
        this.listeners.forEach((listener) => listener());
    }
}
