# Spezifikation: Dynamic Input

## Übersicht

**Dynamic Input** ist eine Zeichenhilfe, die Befehlsaufforderungen, Distanz, Winkel und Koordinaten **direkt am Cursor** anzeigt (Heads-up Display).

Statt ständig zur Befehlszeile zu schauen, kann der Benutzer Werte direkt am Crosshair eingeben. Die Funktion ist besonders nützlich beim Zeichnen, Verschieben (MOVE), Kopieren und anderen Befehlen, die Punkte oder Distanzen erwarten.

Sie besteht aus drei Komponenten:
1. **Pointer Input** (Zeiger-Eingabe)
2. **Dimension Input** (Maß-Eingabe)
3. **Dynamic Prompts** (Dynamische Aufforderungen)

---

## Aktivierung

| Methode              | Beschreibung                          |
|----------------------|---------------------------------------|
| **F12**              | Ein-/Ausschalten                      |
| Statusleisten-Button | Dynamic Input                         |
| Systemvariable       | `DYNMODE` (0 = aus, 1–3 = verschiedene Modi) |

### DYNMODE-Werte

| Wert | Pointer Input | Dimension Input | Beschreibung |
|------|---------------|-----------------|--------------|
| 0    | Aus           | Aus             | Dynamic Input komplett aus |
| 1    | An            | Aus             | Nur Pointer Input |
| 2    | Aus           | An              | Nur Dimension Input |
| 3    | An            | An              | Beide aktiv (empfohlen) |

---

## Die drei Komponenten

### 1. Pointer Input
- Zeigt Koordinaten (X, Y) oder Distanz/Winkel direkt am Cursor.
- Beim **ersten Punkt** eines Befehls: meist absolute Koordinaten.
- Bei **nachfolgenden Punkten**: standardmäßig relative polare Koordinaten (Distanz < Winkel).
- Eingabe möglich direkt im Tooltip.
- Mit **Tab** zwischen den Feldern wechseln.
- `#` erzwingt absolute Koordinaten (z. B. `#0,0`).

### 2. Dimension Input
- Zeigt temporäre Maßlinien und Werte (Länge, Winkel) an der Geometrie.
- Werte aktualisieren sich live beim Bewegen des Cursors.
- Werte können direkt überschrieben werden.
- Besonders sichtbar beim Zeichnen von Linien, Rechtecken usw.

### 3. Dynamic Prompts
- Zeigt die aktuelle Befehlsaufforderung und verfügbare Optionen am Cursor an.
- Optionen können per Tastaturkürzel ausgewählt werden.
- Reduziert den Blick zur Befehlszeile.

---

## Visuelle Darstellung

| Element              | Aussehen                              | Inhalt |
|----------------------|---------------------------------------|--------|
| **Tooltip / Eingabefeld** | Kleines Rechteck am Cursor     | Distanz, Winkel oder Koordinaten |
| **Temporäre Maße**   | Gestrichelte Maßlinien + Text         | Länge und Winkel |
| **Prompt**           | Text neben dem Cursor                 | Aktuelle Aufforderung + Optionen |
| **Aktives Feld**     | Hervorgehoben (meist weiß/hell)       | Feld, in das getippt wird |

---

## Ablauf im MOVE-Befehl

```
[Basispunkt gewählt]
        ↓
[Zustand: Second Point]
        ↓
[Dynamic Input zeigt Distanz + Winkel am Cursor]
        ↓
[Optional: Polar- oder Tracking-Linie aktiv]
        ↓
[User tippt Distanz (oder Distanz + Winkel)]
        ↓
[Zweiter Punkt wird berechnet und Objekte verschoben]
```

### Typische Eingaben beim MOVE

| Eingabe          | Bedeutung                              |
|------------------|----------------------------------------|
| `100`            | 100 Einheiten in aktueller Cursor-Richtung |
| `100<45`         | 100 Einheiten bei 45°                  |
| `100,50`         | Relativ X=100, Y=50                    |
| `#200,300`       | Absolut zu Koordinate 200,300          |
| Tab              | Zwischen Distanz- und Winkel-Feld wechseln |

---

## Technische Umsetzungshinweise

### Datenstrukturen

```text
DynamicInputSettings {
  enabled: bool
  pointerInputEnabled: bool
  dimensionInputEnabled: bool
  dynamicPromptsEnabled: bool
  defaultRelative: bool          // true = relative polar nach erstem Punkt
  showTooltip: bool
}

DynamicInputState {
  active: bool
  currentFields: List<InputField>   // Distanz, Winkel, X, Y ...
  focusedFieldIndex: int
  lastPoint: Point2D
}
```

### Wichtige Verhaltensregeln

1. **Erster Punkt** eines Befehls → absolute Koordinaten (X,Y).
2. **Zweiter und weitere Punkte** → standardmäßig relativ polar (Distanz < Winkel).
3. `#` schaltet auf absolute Koordinaten um.
4. `@` ist bei Dynamic Input meist nicht nötig (relativ ist Default).
5. **Tab** wechselt zwischen den Eingabefeldern.
6. Bei aktiver Polar- oder Tracking-Linie reicht die Eingabe einer reinen Distanz.
7. Die Anzeige aktualisiert sich kontinuierlich mit der Mausbewegung.

### Integration mit anderen Hilfen

| Kombination                     | Verhalten |
|---------------------------------|-----------|
| + Polar Tracking                | Distanz-Eingabe entlang der Polar-Linie |
| + Object Snap Tracking          | Distanz-Eingabe entlang der Tracking-Linie |
| + Ortho Mode                    | Nur horizontale/vertikale Eingaben |
| + Object Snapping               | Tooltip zeigt Snap-Information |

---

## Randfälle & Empfehlungen

- **Kein aktiver Befehl**: Dynamic Input zeigt nichts oder nur Koordinaten.
- **Mehrere Felder**: Klar hervorheben, welches Feld gerade aktiv ist.
- **Eingabe abbrechen**: Esc bricht die aktuelle Eingabe ab.
- **Performance**: Tooltip-Position sollte dem Cursor folgen, ohne zu flackern.
- **Einheiten**: Distanz und Winkel entsprechend der Zeichnungseinheiten und Winkeleinstellungen formatieren.

---

## Anforderungen (Checkliste)

- [ ] Ein-/Ausschalten per F12 und Statusleisten-Button
- [ ] Pointer Input (Koordinaten / Distanz+Winkel am Cursor)
- [ ] Dimension Input (temporäre Maße)
- [ ] Dynamic Prompts (Befehlsaufforderungen am Cursor)
- [ ] Direkte Eingabe in den Tooltips
- [ ] Tab zum Wechseln zwischen Feldern
- [ ] Unterstützung für relative und absolute Eingabe (`#`)
- [ ] Live-Aktualisierung von Distanz und Winkel
- [ ] Integration mit Polar Tracking und Object Snap Tracking
- [ ] Integration in den MOVE-Befehl (zweiter Punkt)

---

## Zusammenfassung

Dynamic Input bringt die Eingabe und Rückmeldung direkt an den Cursor und reduziert den Blick zur Befehlszeile. Es ist eine der nützlichsten Ergänzungen zu Object Snapping, Polar Tracking und Object Snap Tracking und sollte als eigenständiges, konfigurierbares Feature umgesetzt werden.
