# MIRROR-Befehl in AutoCAD – Funktionsweise und Umsetzung

## 1. Überblick

Der **MIRROR**-Befehl erstellt eine spiegelbildliche Kopie (oder Verschiebung) von einem oder mehreren Objekten über eine definierte Spiegelachse (Mirror Line).

Typische Einsatzgebiete:
- Symmetrische Konstruktionen (z. B. linke/rechte Seite eines Bauteils)
- Schnelles Duplizieren mit Umkehrung
- Erstellung der zweiten Hälfte einer Zeichnung aus einer bereits gezeichneten Hälfte

---

## 2. Ablauf in AutoCAD (Schritt für Schritt)

### Schritt 1: Befehl starten
- Ribbon: **Home → Modify → Mirror**
- Befehl: `MIRROR` oder Shortcut `MI`
- Alternativ: Objekte vorher auswählen und dann den Befehl starten

### Schritt 2: Objekte auswählen
- Prompt: `Select objects:`
- Es können **ein oder mehrere Objekte** ausgewählt werden.
- Alle üblichen Auswahlmethoden funktionieren:
  - Einzelklick
  - Window (links → rechts)
  - Crossing (rechts → links)
  - Fence, Window Polygon, etc.
- Auswahl mit **Enter** oder Rechtsklick abschließen.
- Die ausgewählten Objekte werden hervorgehoben (highlighted).

### Schritt 3: Ersten Punkt der Spiegelachse festlegen
- Prompt: `Specify first point of mirror line:`
- Dies ist der erste Punkt der temporären Spiegelachse.
- Object Snaps (Endpoint, Midpoint, Intersection, Center, Nearest usw.) können und sollten verwendet werden.
- Orthogonal-Modus (Ortho) oder Polar Tracking helfen bei horizontalen/vertikalen Achsen.

### Schritt 4: Zweiten Punkt der Spiegelachse festlegen (mit Vorschau)
- Prompt: `Specify second point of mirror line:`
- **Dynamische Vorschau**: Während die Maus bewegt wird, zeigt AutoCAD eine Live-Vorschau der gespiegelten Objekte.
- Die Spiegelachse wird als temporäre Linie zwischen dem ersten Punkt und der aktuellen Mausposition angezeigt.
- Mit dem zweiten Klick wird die Achse endgültig festgelegt.
- Die beiden Punkte definieren die unendlich lange Spiegelachse (nicht nur das Segment zwischen den Punkten).

### Schritt 5: Quellobjekte löschen?
- Prompt: `Erase source objects? [Yes/No] <N>:`
- **No** (Standard, Enter): Originalobjekte bleiben erhalten → es entsteht eine Kopie.
- **Yes**: Originalobjekte werden gelöscht → die Objekte werden quasi verschoben und gespiegelt.
- Nach der Bestätigung werden die gespiegelten Objekte erstellt.

---

## 3. Wichtige Details und Besonderheiten

### Spiegelachse
- Die Spiegelachse ist eine **unendliche Gerade**, die durch die beiden angegebenen Punkte verläuft.
- Sie kann jeden beliebigen Winkel haben (nicht nur horizontal oder vertikal).
- In 2D definiert die Linie eine Spiegelebene senkrecht zur XY-Ebene des aktuellen UCS.

### Text und spezielle Objekte
- **Text, MText, Attribute**: Standardmäßig wird Text **nicht** gespiegelt (bleibt lesbar).
  - Systemvariable `MIRRTEXT = 0` (Standard): Text bleibt lesbar.
  - `MIRRTEXT = 1`: Text wird ebenfalls gespiegelt (umgekehrt).
- **Schraffuren**: Systemvariable `MIRRHATCH` steuert, ob die Schraffurrichtung mitgespiegelt wird.
- **Blöcke**: Text in Blöcken wird in der Regel mitgespiegelt, unabhängig von `MIRRTEXT`.

### Dynamische Vorschau
- Ab dem ersten Punkt der Spiegelachse wird bei jeder Mausbewegung die Vorschau aktualisiert.
- Die Vorschau zeigt die gespiegelten Objekte in der voraussichtlichen Position.
- Orthogonal-Modus und Polar Tracking wirken sich auf die Vorschau aus und erleichtern präzise Achsen.

### Weitere Hinweise
- Der Befehl kann auch über Grips ausgeführt werden (Grip auswählen → Mirror-Modus).
- In 3D gibt es den separaten Befehl `MIRROR3D` (nicht in AutoCAD LT).
- Die gespiegelten Objekte erben Layer, Farbe, Linientyp usw. der Originale.

---

## 4. Empfohlene Umsetzung in der eigenen Software

### Datenfluss / State Machine
1. **Zustand: Objektauswahl**  
   Benutzer wählt ein oder mehrere Objekte aus → Liste der zu spiegelnden Objekte speichern.

2. **Zustand: Erster Punkt der Spiegelachse**  
   Ersten Punkt `P1` abfragen (mit Object Snaps).

3. **Zustand: Zweiter Punkt + Live-Preview**  
   - Bei jeder Mausbewegung:
     - Temporäre Spiegelachse von `P1` zur aktuellen Mausposition berechnen.
     - Alle ausgewählten Objekte spiegeln und als Ghost/Preview zeichnen.
     - Spiegelachse selbst temporär darstellen.
   - Bei Klick: `P2` festlegen.

4. **Zustand: Quellobjekte löschen?**  
   Dialog oder Prompt: „Originalobjekte löschen?“ (Ja/Nein).

5. **Finalisierung**  
   - Gespiegelte Objekte endgültig in die Zeichnung einfügen.
   - Optional: Originale löschen.
   - Undo-Eintrag erstellen.

### Mathematische Spiegelung eines Punktes

Gegeben: Punkt \( P \), Spiegelachse durch Punkte \( A \) und \( B \).

1. Richtungsvektor der Achse:  
   \(\vec{d} = B - A\)

2. Projektion von \( P - A \) auf die Achse:  
   \( t = \frac{(P - A) \cdot \vec{d}}{\vec{d} \cdot \vec{d}} \)  
   \( P_{proj} = A + t \cdot \vec{d} \)

3. Gespiegelter Punkt:  
   \( P' = 2 \cdot P_{proj} - P \)

Diese Formel auf alle Eckpunkte, Kontrollpunkte, Zentren usw. der Objekte anwenden.

### Spezielle Behandlung
- **Linien, Polylinien, Rechtecke**: Alle Punkte spiegeln.
- **Kreise**: Zentrum spiegeln (Radius bleibt gleich).
- **Bögen**: Zentrum spiegeln + Start-/Endwinkel und Sweep-Richtung anpassen.
- **Text**: Je nach Einstellung spiegeln oder nicht (Position spiegeln, Orientierung ggf. erhalten).
- **Blöcke**: Einfügepunkt spiegeln + Rotation anpassen.

### Empfohlene Features
- Live-Preview (Ghost-Objekte in anderer Farbe oder gestrichelt)
- Anzeige der temporären Spiegelachse
- Unterstützung für Ortho / Polar Tracking während der Achsenauswahl
- Object Snaps auf die Spiegelpunkte
- Option „Original löschen“ als Checkbox oder Prompt
- Unterstützung für Text-Spiegelung (analog zu `MIRRTEXT`)
- Multi-Selection und Crossing/Window-Auswahl

---

## 5. Zusammenfassung der Implementierungsschritte

1. Command `MIRROR` registrieren.
2. Objektauswahl implementieren (ein oder mehrere Objekte).
3. Zwei Punkte für die Spiegelachse abfragen.
4. Dynamische Vorschau während der Auswahl des zweiten Punkts realisieren.
5. Alle ausgewählten Objekte mathematisch spiegeln.
6. Prompt/Dialog für „Originalobjekte löschen?“ anbieten.
7. Gespiegelte Objekte in die Zeichnungsdatenbank einfügen und ggf. Originale entfernen.
8. Undo/Redo unterstützen.

Damit lässt sich das Verhalten des AutoCAD-MIRROR-Befehls sehr genau nachbilden.

---

## 6. Ergänzungen (in der Beschreibung oben nicht genannt)

- **Vorauswahl (Pickfirst)**: Ist beim Start schon etwas gewählt, entfällt `Select objects:`.
- **Gleiche Punkte**: Fällt der zweite Punkt auf den ersten, gibt es keine Achse; AutoCAD nimmt
  den Punkt nicht an und fragt erneut.
- **Vorschau bei `Erase source objects?`**: Die Spiegelbilder und die Achse bleiben stehen, bis
  die Frage beantwortet ist; ein Klick beantwortet sie nicht.
- **Enter, Leertaste und Rechtsklick** nehmen die Vorgabe `<N>`; **Esc** bricht bei jeder
  Aufforderung ab, ohne etwas zu ändern.
- **Bogenrichtung**: Eine Spiegelung kehrt den Drehsinn um. Das betrifft Bögen (Richtung),
  Bogensegmente von Polylinien (Vorzeichen des Bulge) und die Drehung von Ellipsen.
- **Gruppen**: Kopien gruppierter Objekte bilden eine eigene Gruppe.
- **Ein Rückgängig-Schritt**, ob mit oder ohne Löschen der Quellobjekte.

## 7. Umsetzung in WebCAD

Befehl **SPIEGELN** (`MIRROR`, Alias `MI`), siehe `docs/bedienung.md`, Abschnitt "Befehl SPIEGELN".

| Aufforderung | Art | Eingabe |
|---|---|---|
| `SPIEGELN Objekte wählen:` | Objektwahl | entfällt mit Vorauswahl |
| `Ersten Punkt der Spiegelachse angeben:` | Punkt | Objektfang, Objektfangspuren, Koordinaten |
| `Zweiten Punkt der Spiegelachse angeben:` | Punkt ab dem ersten | dazu Polarspur, Ortho, direkte Abstandseingabe, dynamische Eingabe; Vorschau |
| `Quellobjekte löschen? [Ja/Nein] <N>:` | nur Schlüsselwort | `J`, `N`, Enter |

- `MirrorTool` (`src/cad/editor/tools/MirrorTool.ts`) ist die Zustandsmaschine; die Spiegelung
  ist `reflectionAcross` (`src/cad/geometry/similarity.ts`), exakt für waagrechte und senkrechte Achsen.
- **Nein** führt einen `CopyCommand` aus (Kopien mit eigenen Scheitelpunkten, Layer, Stil und
  Name der Originale), **Ja** einen `TransformCommand`: Objekte, die nicht gewählt sind und einen
  Scheitelpunkt mit einem gespiegelten teilen, behalten eine Kopie des Punkts an der alten Stelle.
- Die letzte Aufforderung ist eine Schlüsselwort-Abfrage (`ToolPrompt` `keyword`), die erste
  ihrer Art im Editor: kein Fang, keine dynamischen Felder, die Vorschau bleibt stehen.
- Was fehlt (Text, Schraffuren, Blöcke, Grip-Modus mit Kopie als Vorgabe), steht in
  `docs/todo/Mirror_NotImplemented.md`.

---

*Erstellt als Referenz für die eigene CAD-Entwicklung.*
