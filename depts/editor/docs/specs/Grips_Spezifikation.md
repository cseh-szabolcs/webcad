# AutoCAD Grips – Ausführliche Beschreibung

Dieses Dokument beschreibt das Verhalten der **Grips** (Griffe) in AutoCAD, wenn Objekte markiert sind. Es orientiert sich am Video [The Grip Hack Every CAD Designer Should Know](https://www.youtube.com/shorts/mQrTXYBPpmg) und an der offiziellen Funktionsweise von AutoCAD.

Ziel: Eine präzise Spezifikation, die als Grundlage für die Implementierung eines ähnlichen Grip-Systems (z. B. in einem eigenen CAD- oder Zeichenprogramm mit Claude Code) dienen kann.

## 1. Grundkonzept

Grips sind kleine interaktive Handles (normalerweise Quadrate, manchmal Rechtecke oder Dreiecke), die an geometrisch relevanten Punkten eines Objekts erscheinen, sobald das Objekt **ohne aktiven Befehl** ausgewählt wird.

**Typische Positionen:**
- Linie: Startpunkt, Mittelpunkt, Endpunkt
- Kreis: Mittelpunkt + 4 Quadranten
- Bogen: Start, Mittel, End
- Polylinie: alle Vertices + Mittelpunkte der Segmente
- Block / Text: Einfügepunkt
- u. v. m.

**Farbzustände (Standard):**
| Zustand              | Farbe (Default) | Bedeutung                                      |
|----------------------|-----------------|------------------------------------------------|
| Warm (unselected)    | Blau            | Objekt ist selektiert, Grip ist noch nicht aktiv |
| Hover                | Cyan/Pink       | Maus über dem Grip → Multifunktionsmenü möglich |
| Hot (selected)       | Rot             | Grip ist aktiv und dient als Basispunkt        |

## 2. Interaktionsmodi

### 2.1 Standard-Grip-Modi (nach Klick auf einen Grip)

Nach dem Anklicken eines Grips (Grip wird „hot“) startet standardmäßig der **STRETCH**-Modus. Mit **Leertaste** oder **Enter** kann durch die fünf klassischen Modi zyklisch gewechselt werden:

1. **STRETCH** (Strecken)
2. **MOVE** (Verschieben)
3. **ROTATE** (Drehen)
4. **SCALE** (Skalieren)
5. **MIRROR** (Spiegeln)

Danach beginnt der Zyklus wieder bei STRETCH.

**Gemeinsame Unteroptionen in allen Modi:**
- `B` → Base Point: Anderen Basispunkt wählen
- `C` → Copy: Original behalten und Kopien erzeugen (mehrfach klickbar)
- `U` → Undo: letzten Schritt rückgängig
- `X` → Exit

Zusätzlich in ROTATE und SCALE:
- `R` → Reference: Referenzwinkel oder -länge verwenden

**Wichtiges Verhalten:**
- Endpoint-Grip einer Linie → Strecken (andere Seite bleibt fest)
- Midpoint-Grip einer Linie → Verschieben der gesamten Linie
- Center-Grip eines Kreises → Verschieben
- Quadrant-Grip eines Kreises → Radius ändern (Stretch)
- Block-Einfügepunkt → immer Verschieben (kein Strecken)

Mehrere Grips gleichzeitig „hot“ machen: **Shift** gedrückt halten und nacheinander anklicken. Danach bewegen sich alle hot Grips synchron (Form bleibt zwischen den Grips erhalten).

### 2.2 Multifunktionale Grips (Hover-Menü)

Das ist der Kern des Videos: **Nicht klicken**, sondern ca. 0,5 s über einen Grip **hovern**.

Dann erscheint ein kontextsensitives Menü mit objektspezifischen Optionen. Kein Befehl muss getippt werden.

**Beispiele (aus dem Video und Standardverhalten):**

#### Linien
- Endpoint-Grip: **Stretch** / **Lengthen**
- Midpoint-Grip: meist Move (kein spezielles Menü oder eingeschränkt)

#### Polylinien (besonders mächtig)
**Vertex-Grip (Quadrat):**
- Stretch Vertex
- Add Vertex
- Remove Vertex
- (manchmal) Convert to Arc

**Segment-Midpoint-Grip (Rechteck):**
- Stretch (Segment parallel verschieben)
- Add Vertex
- Convert to Arc (bei geradem Segment)
- Convert to Line (bei Bogen-Segment)

#### Kreise / Ellipsen
- Quadrant: Stretch (Radius/Größe)
- Center: Move
- Kein umfangreiches Multifunktionsmenü wie bei Polylinien

#### Weitere Objekte
- **Hatch**: Origin, Angle, Scale
- **Dimensionen**: Continue Dimension, Baseline, Text verschieben etc.
- **Multileader**: Leader hinzufügen/entfernen
- **Splines**: Fit Points vs. Control Vertices, Add/Remove Fit Point usw.

## 3. Technische Umsetzungshinweise (für Claude Code)

### Datenmodell
```typescript
interface Grip {
  id: string;
  position: Point;
  type: 'endpoint' | 'midpoint' | 'center' | 'quadrant' | 'vertex' | 'control';
  objectId: string;
  state: 'warm' | 'hover' | 'hot';
  availableActions: GripAction[];  // abhängig vom Objekt- und Grip-Typ
}

type GripAction = 
  | 'stretch' | 'move' | 'rotate' | 'scale' | 'mirror'
  | 'lengthen' | 'addVertex' | 'removeVertex' 
  | 'convertToArc' | 'convertToLine'
  | 'changeOrigin' | 'changeAngle' | 'changeScale'
  // ...
```

### Interaktionsfluss
1. **Selektion** eines Objekts → Grips an relevanten Punkten rendern (warm).
2. **Hover** über Grip → nach kurzer Verzögerung Menü anzeigen (oder Ctrl-Cycling).
3. **Klick** auf Grip → Grip wird hot, Standard-Modus STRETCH starten, Basispunkt = Grip-Position.
4. **Leertaste** → Modus wechseln (Stretch → Move → Rotate → Scale → Mirror).
5. **Mausbewegung** → Live-Preview der Transformation.
6. **Klick** auf Zielpunkt oder Zahleneingabe (Dynamic Input) → anwenden.
7. **Esc** → abbrechen.

### Wichtige Regeln für die Implementierung
- Grips nur anzeigen, wenn kein anderer Befehl aktiv ist.
- Bei mehreren selektierten Objekten: Grips aller Objekte anzeigen, aber objekt-spezifische Multifunktionsmenüs nur bei Einzelobjekt.
- Snap-Verhalten: Grips können als Snap-Punkte dienen (auch wenn OSNAP aus ist).
- Performance: Bei sehr vielen Objekten Grips optional begrenzen (entspricht GRIPOBJLIMIT).

## 4. Zusammenfassung des Video-Hacks

> „Die blauen Grips sind nicht nur zum Verschieben – sie sind multifunktional.“

1. Objekt selektieren
2. Über einen Grip hoovern (kurz warten)
3. Menü mit smarten Optionen erscheint (Stretch, Lengthen, Add Vertex, Remove Vertex, Scale, Mirror, Convert to Arc …)
4. Option wählen → direkt anwenden

Das spart Befehle und beschleunigt die Bearbeitung erheblich.

## 5. Quellen & Weiterführendes

- AutoCAD Help: About Editing with Grips
- Autodesk Blog: Get a Grip With AutoCAD (Donnie Gladfelter)
- Video: https://www.youtube.com/shorts/mQrTXYBPpmg

---

*Erstellt als Spezifikation für die Umsetzung eines vergleichbaren Grip-Systems.*
