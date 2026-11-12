# Start, Center, Angle Arc in AutoCAD und Umsetzung in eigener CAD-Software

## 1. Funktionsweise in AutoCAD

### Grundprinzip
Bei der Methode **Start, Center, Angle** (auch „Start, Zentrum, Winkel“) wird ein Kreisbogen definiert durch:

1. **Startpunkt** – Beginn des Bogens
2. **Mittelpunkt** – Zentrum des zugehörigen Kreises
3. **Eingeschlossener Winkel** (Included Angle) – bestimmt die Länge und den Endpunkt des Bogens

**Wichtige Regeln:**

- Der **Radius** wird ausschließlich durch den Abstand zwischen Startpunkt und Mittelpunkt festgelegt.
- Der eingeschlossene Winkel hat den Mittelpunkt als Scheitelpunkt.
- Standardmäßig wird der Bogen **gegen den Uhrzeigersinn** (counter-clockwise) gezeichnet.
- Ein **negativer Winkel** erzeugt den Bogen **im Uhrzeigersinn** (clockwise).
- Während der dynamischen Eingabe des Winkels kann die **Ctrl-Taste** die Richtung umkehren.
- Der Winkel kann sowohl numerisch (z. B. `90`, `-180`) als auch durch Anklicken eines Punktes angegeben werden.

### Aufruf in AutoCAD
- Ribbon: **Home → Draw → Arc-Dropdown → Start, Center, Angle**
- Befehl: `ARC` → Optionen entsprechend wählen
- Es existiert auch die Variante **Center, Start, Angle** (Reihenfolge der ersten beiden Punkte getauscht)

### Typisches Verhalten
- Nach Auswahl von Start und Center erscheint die Prompt für den eingeschlossenen Winkel.
- Bei dynamischer Eingabe (Mausbewegung) wird der Bogen live angezeigt.
- Ein positiver Winkel = CCW, ein negativer Winkel = CW.
- Ideal, wenn der eingeschlossene Winkel bekannt ist (z. B. 90°, 180° für Halbkreise, 45° usw.).

### Praktisches Beispiel
Für einen 180°-Bogen (Halbkreis):
- Startpunkt wählen
- Mittelpunkt wählen
- Winkel `180` eingeben → CCW-Halbkreis  
- oder `-180` eingeben → CW-Halbkreis

---

## 2. Mathematische Grundlagen

Gegeben:
- \( P_{start} \) – Startpunkt
- \( O \) – Mittelpunkt
- \( \alpha \) – eingeschlossener Winkel in Grad (positiv = CCW, negativ = CW)

### Radius
\[
R = \sqrt{(P_{start.x} - O.x)^2 + (P_{start.y} - O.y)^2}
\]

### Startwinkel
\[
\text{angleStart} = \operatorname{atan2}(P_{start.y} - O.y,\ P_{start.x} - O.x)
\]

### Endwinkel
Winkel in Radiant umrechnen und auf den Startwinkel addieren:

\[
\alpha_{rad} = \alpha \cdot \frac{\pi}{180}
\]

\[
\text{angleEnd} = \text{angleStart} + \alpha_{rad}
\]

### Tatsächlicher Endpunkt
\[
\begin{align*}
P_{end.x} &= O.x + R \cdot \cos(\text{angleEnd}) \\
P_{end.y} &= O.y + R \cdot \sin(\text{angleEnd})
\end{align*}
\]

### Richtung
- \(\alpha > 0\) → counter-clockwise
- \(\alpha < 0\) → clockwise
- \(\alpha = 0\) oder \( \pm 360^\circ \) → voller Kreis (meist als Sonderfall behandeln)

---

## 3. Empfohlene Umsetzung in der Software

### Datenstruktur
Identisch zu den vorherigen Arc-Varianten:

```text
struct Arc {
    Point center;
    double radius;
    double startAngle;      // Radiant
    double endAngle;        // Radiant
    bool counterClockwise;
}
```

### Ablauf des Befehls (State Machine)
1. **Zustand: Startpunkt**  
   Benutzer wählt \( P_{start} \)

2. **Zustand: Mittelpunkt**  
   Benutzer wählt \( O \)  
   → Radius berechnen und anzeigen

3. **Zustand: Winkel**  
   - Numerische Eingabe erlauben (positiv/negativ)
   - Alternativ: dynamische Eingabe durch Mausbewegung (Winkel live berechnen)
   - Ctrl-Taste abfragen, um die Vorzeichenrichtung zu invertieren
   - Live-Preview des Bogens zeichnen
   - Bei Bestätigung: Arc finalisieren

### Pseudocode
```python
def createStartCenterAngleArc(start, center, angleDegrees):
    radius = distance(start, center)
    if radius < epsilon:
        return None

    angleStart = atan2(start.y - center.y, start.x - center.x)
    angleRad = radians(angleDegrees)
    angleEnd = angleStart + angleRad

    counterClockwise = angleDegrees >= 0

    return Arc(
        center=center,
        radius=radius,
        startAngle=angleStart,
        endAngle=angleEnd,
        counterClockwise=counterClockwise
    )
```

### Dynamische Winkeleingabe (optional, aber empfohlen)
```python
def calculateIncludedAngle(center, start, mousePos):
    a1 = atan2(start.y - center.y, start.x - center.x)
    a2 = atan2(mousePos.y - center.y, mousePos.x - center.x)
    delta = normalizeAngle(a2 - a1)  # 0 … 2π
    return degrees(delta)  # oder mit Ctrl-Taste negativ machen
```

### Empfohlene Features
- Anzeige des aktuellen Winkels während der Mausbewegung
- Unterstützung für numerische Eingabe (inkl. negativer Werte)
- Ctrl-Taste zum Vorzeichenwechsel
- Object Snaps
- Grip-Editierung (Start, Center, Winkel nachträglich anpassbar)
- Begrenzung sinnvoller Winkelbereiche (z. B. Warnung bei |α| > 360°)

---

## 4. Vergleich mit den anderen Methoden

| Eigenschaft       | 3-Point                  | Start-Center-End              | Start-Center-Angle          |
|-------------------|--------------------------|-------------------------------|-----------------------------|
| Radius            | berechnet                | Start–Center                  | Start–Center                |
| Richtung          | frei                     | CCW (Ctrl = CW)               | positiv = CCW, negativ = CW |
| Endpunkt          | exakt auf dem Bogen      | Richtungsgeber                | durch Winkel berechnet      |
| Typischer Einsatz | freies Skizzieren        | bekannter Mittelpunkt + End   | bekannter eingeschlossener Winkel |

---

## 5. Zusammenfassung der Implementierungsschritte

1. Command „StartCenterAngle“ registrieren.
2. Startpunkt und Mittelpunkt abfragen.
3. Eingeschlossenen Winkel abfragen (numerisch oder dynamisch).
4. Radius und Winkel berechnen.
5. Endwinkel = Startwinkel ± Included Angle.
6. Arc-Objekt speichern und rendern.

Damit entspricht das Verhalten weitgehend dem von AutoCAD.

---

## 6. Ergänzungen aus der Umsetzung im Editor

Was die Beschreibung oben offen lässt oder anders darstellt, und wie es der Editor macht
(Bedienung in `docs/bedienung.md`, Abschnitt „Befehl BOGEN“):

- **Winkel durch Zeigen:** AutoCAD misst den eingeschlossenen Winkel wie bei jeder
  Winkel-Abfrage als Richtung des Gummibands **vom Mittelpunkt zum Punkt, ab der X-Achse**,
  nicht ab dem Startpunkt. Zeigt man vom Mittelpunkt genau nach oben, ist der Winkel 90°, egal
  wo der Startpunkt liegt. `calculateIncludedAngle` in Abschnitt 3 misst dagegen ab dem
  Startpunkt; das wäre dasselbe wie „Start, Zentrum, Ende“. Der Editor folgt AutoCAD.
- **Vorzeichen:** Ein gezeigter Winkel liegt immer zwischen 0° und 360° (nach unten zeigen ist
  270°, nicht −90°), der Bogen läuft dann gegen den Uhrzeigersinn. Negativ ist nur ein getippter
  Winkel.
- **0° und volle Drehungen** ergeben keinen Bogen (ein `ArcElement` mit gleichem Start- und
  Endwinkel wäre ein voller Kreis): Meldung, die Abfrage bleibt. Größere Winkel zählen modulo
  360 (`450` wie `90`).
- **Strg** kehrt die Richtung um, auch die eines negativen Winkels. Im Editor schaltet ein
  Druck um, statt dass die Taste gehalten wird (wie bei „Start, Zentrum, Ende“, Grund dort).
- **Aufruf über Optionen:** `BOGEN` → Startpunkt → `Z` (Zentrum) → Mittelpunkt → `W` (Winkel);
  im Englischen `C` und `A`. Die Aufforderung heißt in AutoCAD `Eingeschlossenen Winkel angeben
  (zum Wechseln der Richtung STRG-Taste gedrückt halten):`.
- **Endpunkt:** Der Startpunkt wird um den Mittelpunkt gedreht; Vielfache von 90° exakt
  (`rotationAbout` in `src/cad/geometry/similarity.ts`). Gespeichert wird dieser Punkt.
- **Noch offen:** ein Winkelfeld der dynamischen Eingabe und die Anzeige des aktuellen Winkels
  am Cursor (siehe `docs/todo/Arc_Draw_NotImplemented.md`).

---

*Erstellt als Referenz für die eigene CAD-Entwicklung.*
