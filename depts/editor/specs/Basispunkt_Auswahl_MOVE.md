# Spezifikation: Basispunkt-Auswahl für den MOVE-Befehl

## Übersicht

Dieses Dokument beschreibt die Implementierung der **Basispunkt-Auswahlphase** des MOVE-Werkzeugs (Bewegen), analog zu AutoCAD.

**Voraussetzung:** Die Objektauswahl ist bereits implementiert.  
**Ziel dieser Phase:** Der Benutzer wählt einen Basispunkt (Base Point). Der tatsächliche Verschiebevorgang (zweiter Punkt / Displacement) wird in einer späteren Phase umgesetzt.

Der Basispunkt dient als Referenzpunkt für den Verschiebevektor. Er kann ein beliebiger Punkt im Modellraum sein, wird in der Praxis aber fast immer über **Object Snaps (OSNAP)** präzise auf Geometrie gesetzt.

---

## Workflow / Zustandsübergang

```
[Objekte ausgewählt]
        ↓
[User klickt auf „Bewegen“-Werkzeug]
        ↓
[Zustand: BasePointSelection]
   • Crosshair-Cursor aktiv
   • Object-Snap-Erkennung läuft
   • Snap-Marker + Tooltip werden angezeigt
        ↓
[User klickt (oder bestätigt)]
        ↓
[Basispunkt gespeichert]
        ↓
[Übergang in nächste Phase: SecondPoint / MovePreview]
```

### Verhalten im Zustand `BasePointSelection`

- Die bereits ausgewählten Objekte bleiben selektiert (ggf. visuell hervorgehoben, z. B. gestrichelt oder in einer anderen Farbe).
- Der Cursor wechselt in den Crosshair-Modus.
- Beim Bewegen der Maus wird kontinuierlich geprüft, ob sich innerhalb der **Aperture** (Fangradius) gültige Snap-Punkte befinden.
- Bei einem gültigen Snap wird der entsprechende Marker gezeichnet und der Cursor magnetisch an den Punkt gezogen (optional, aber empfohlen).
- Ein Klick nimmt entweder den aktuell aktiven Snap-Punkt oder den Rohklickpunkt als Basispunkt.
- Abbruch (Esc) bricht den MOVE-Befehl ab und kehrt zur normalen Auswahl zurück.

---

## Object Snaps (OSNAP) – unterstützte Typen

Die folgenden Snap-Typen sollten unterstützt werden. Sie entsprechen den gängigen AutoCAD-OSNAP-Modi.

| Snap-Typ              | Beschreibung                                      | Typische Marker-Form     | Priorität (empfohlen) |
|-----------------------|---------------------------------------------------|--------------------------|-----------------------|
| **Endpoint**          | Endpunkte von Linien, Bögen, Polylinien-Segmenten | Quadrat                  | Hoch                  |
| **Midpoint**          | Mittelpunkt von Linien/Bögen/Polylinien-Segmenten | Dreieck                  | Hoch                  |
| **Center**            | Mittelpunkt von Kreisen, Ellipsen, Bögen          | Kreis                    | Hoch                  |
| **Geometric Center**  | Schwerpunkt geschlossener Polylinien              | Stern / 8-Zacken         | Mittel                |
| **Quadrant**          | Quadrantenpunkte (0°, 90°, 180°, 270°)           | Raute (Diamond)          | Mittel                |
| **Intersection**      | Echter Schnittpunkt zweier Objekte                | X                        | Hoch                  |
| **Node**              | Punkt-Objekte, Messpunkte etc.                    | Kreis mit Kreuz          | Mittel                |
| **Insertion**         | Einfügepunkt von Blöcken / Text                   | Doppeltes Quadrat        | Mittel                |
| **Perpendicular**     | Senkrechter Fußpunkt                              | Rechtwinkelsymbol        | Mittel                |
| **Tangent**           | Tangentenpunkt                                    | Kreis mit Tangente       | Mittel                |
| **Nearest**           | Nächster Punkt auf der Geometrie                  | Sanduhr / Hourglass      | Niedrig (optional)    |
| **Extension**         | Verlängerung über Endpunkt hinaus                 | Gestrichelte Linie + +   | Erweitert             |

**Empfehlung für den Start:**  
Endpoint, Midpoint, Center, Intersection und Quadrant reichen für die meisten Anwendungsfälle aus. Die restlichen können später ergänzt werden.

### Snap-Priorität

Wenn mehrere Snaps innerhalb der Aperture liegen, gewinnt der mit der höchsten Priorität.  
Innerhalb derselben Priorität gewinnt der geometrisch nächste Punkt.

---

## Visuelle Darstellung (AutoSnap-Stil)

### 1. Marker (Glyph)
- Wird exakt am Snap-Punkt gezeichnet.
- Farbe: Standardmäßig Grün (konfigurierbar).
- Größe: Konfigurierbar (typisch 8–12 Pixel).
- Jeder Snap-Typ hat eine eindeutige Form (siehe Tabelle oben).

### 2. Tooltip / Snap-Tip
- Kleines Textlabel neben dem Marker mit dem Namen des Snaps (z. B. „Endpoint“, „Midpoint“, „Center“).
- Erscheint mit kurzer Verzögerung oder sofort.

### 3. Aperture Box
- Kleines Quadrat um den Crosshair (Fangradius).
- Definiert den Bereich, in dem nach Snap-Punkten gesucht wird.
- Optional ein-/ausblendbar.

### 4. Magnet-Effekt (empfohlen)
- Sobald ein gültiger Snap erkannt wird, wird der Cursor an den Snap-Punkt „gezogen“.
- Der tatsächliche Klickpunkt ist dann der Snap-Punkt, nicht die Mausposition.

### 5. Geometrie-Highlight (optional)
- Das betroffene Objekt oder Segment kann kurzzeitig hervorgehoben werden.

---

## Technische Umsetzung

### Datenstrukturen

```text
SnapCandidate {
  point: Vec2 / Point2D          // Weltkoordinaten
  type: SnapType                 // Endpoint, Midpoint, ...
  objectId: ObjectId             // Referenz auf das Quellobjekt
  priority: int
  distanceToCursor: float        // in Pixel oder Weltkoordinaten
}

SnapSettings {
  enabledSnaps: Set<SnapType>
  apertureSize: float            // in Pixel
  markerSize: float
  markerColor: Color
  showTooltip: bool
  magnetEnabled: bool
}
```

### Algorithmus (pro Mausbewegung)

1. Bestimme die aktuelle Cursor-Position in Weltkoordinaten.
2. Ermittle alle Objekte innerhalb der Aperture (über räumlichen Index / Bounding-Box-Suche).
3. Für jedes gefundene Objekt:
   - Generiere alle relevanten Snap-Punkte gemäß den aktivierten Snap-Typen.
4. Filtere Kandidaten, die außerhalb der Aperture liegen.
5. Sortiere nach Priorität und Distanz.
6. Wähle den besten Kandidaten.
7. Zeichne Marker + Tooltip an der Position des besten Kandidaten.
8. Optional: Setze die effektive Cursor-Position auf den Snap-Punkt (Magnet).

### Snap-Punkt-Generierung (Beispiele)

- **Linie / Polylinien-Segment:**
  - Endpoint: Start- und Endpunkt
  - Midpoint: Mittelpunkt
- **Kreis / Bogen:**
  - Center: Mittelpunkt
  - Quadrant: 4 Punkte auf dem Umfang
  - Endpoint (nur bei Bögen)
- **Polylinie (geschlossen):**
  - Geometric Center: Schwerpunkt
- **Zwei Objekte:**
  - Intersection: Schnittpunktberechnung

### Konfiguration

Der Benutzer sollte (wie in AutoCAD) auswählen können, welche Snaps aktiv sind.  
Empfohlene UI: Statusleisten-Button oder Einstellungsdialog mit Checkboxen für die einzelnen Snap-Typen.

---

## Benutzerinteraktion

| Aktion                  | Verhalten                                              |
|-------------------------|--------------------------------------------------------|
| Maus bewegen            | Snap-Erkennung + Marker aktualisieren                  |
| Linksklick              | Aktuellen Snap (oder Rohpunkt) als Basispunkt übernehmen |
| Esc                     | Abbrechen, zurück zur normalen Auswahl                 |
| Rechtsklick / Enter     | Optional: auch als Bestätigung des Basispunkts        |

Nach erfolgreicher Basispunkt-Auswahl:
- Speichere den Basispunkt (Weltkoordinaten).
- Wechsle in den Zustand für den zweiten Punkt (Move-Preview).
- Ab diesem Zeitpunkt kann die Vorschau der Verschiebung angezeigt werden (wird in der nächsten Phase implementiert).

---

## Randfälle & Hinweise

- **Keine Objekte in der Nähe:** Es wird der Rohklickpunkt verwendet (kein Snap).
- **Mehrere gleichwertige Snaps:** Prioritätsregel anwenden.
- **Sehr kleine Objekte / starker Zoom:** Aperture in Pixel belassen, Weltgröße dynamisch berechnen.
- **Blöcke / Gruppen:** Snap-Punkte der enthaltenen Geometrie berücksichtigen (oder Einfügepunkt des Blocks).
- **Performance:** Bei großen Zeichnungen räumlichen Index (z. B. R-Tree oder Quadtree) verwenden. Snap-Berechnung nur für Objekte in der Nähe des Cursors durchführen.

---

## Nächste Phase (Ausblick)

Nach der Basispunkt-Auswahl folgt die Phase „Zweiter Punkt / Displacement“:

- Vorschau der selektierten Objekte, die dem Cursor folgen (Offset = Cursor − Basispunkt).
- Zweiter Punkt kann ebenfalls über Object Snaps gewählt werden.
- Bestätigung verschiebt die Objekte endgültig um den Vektor `(zweiterPunkt − basisPunkt)`.

---

## Zusammenfassung der Anforderungen

- [ ] Zustand `BasePointSelection` nach Klick auf Bewegen-Werkzeug
- [ ] Kontinuierliche Snap-Erkennung innerhalb der Aperture
- [ ] Visuelle Marker für Endpoint, Midpoint, Center, Intersection, Quadrant (mindestens)
- [ ] Tooltip mit Snap-Namen
- [ ] Magnet-Effekt (optional, empfohlen)
- [ ] Klick übernimmt den Snap-Punkt als Basispunkt
- [ ] Speicherung des Basispunkts und Übergang in die nächste Phase
- [ ] Konfigurierbarkeit der aktiven Snap-Typen

Dieses Dokument dient als Grundlage für die Implementierung der Basispunkt-Auswahl. Die visuelle Darstellung soll möglichst nah am AutoCAD-AutoSnap-Verhalten liegen.
