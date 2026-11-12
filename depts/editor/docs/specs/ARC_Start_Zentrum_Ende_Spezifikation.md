# Start, Center, End Arc in AutoCAD und Umsetzung in eigener CAD-Software

## 1. Funktionsweise in AutoCAD

### Grundprinzip
Bei der Methode **Start, Center, End** wird ein Kreisbogen definiert durch:

1. **Startpunkt** – Beginn des Bogens
2. **Mittelpunkt** – Zentrum des zugehörigen Kreises
3. **Endpunkt** – bestimmt die Richtung, in der der Bogen endet

**Wichtige Regeln:**

- Der **Radius** wird ausschließlich durch den Abstand zwischen Startpunkt und Mittelpunkt festgelegt.
- Der angegebene Endpunkt muss **nicht** genau auf dem Kreis liegen. Er definiert nur die **Richtung**: Der Bogen endet auf dem Strahl, der vom Mittelpunkt durch den angegebenen Endpunkt verläuft.
- Standardmäßig wird der Bogen **gegen den Uhrzeigersinn** (counter-clockwise) gezeichnet.
- Durch Halten der **Ctrl-Taste** während der Auswahl des Endpunkts wird die Richtung auf **im Uhrzeigersinn** (clockwise) umgeschaltet.

### Aufruf in AutoCAD
- Ribbon: **Home → Draw → Arc-Dropdown → Start, Center, End**
- Befehl: `ARC` → Option `C` (Center) → danach Endpunkt
- Alternativ existiert auch die Variante **Center, Start, End** (Reihenfolge der ersten beiden Punkte getauscht)

### Typisches Verhalten / Dynamische Vorschau
Während der Auswahl des Endpunkts zeigt AutoCAD eine Live-Vorschau des Bogens.  
Die Vorschau berücksichtigt sofort, ob die Ctrl-Taste gedrückt ist (Richtungsumkehr).

### Praktisches Beispiel (Türschwenk)
Bei einem Türbogen wählt man bewusst den Startpunkt so, dass der Bogen gegen den Uhrzeigersinn zum gewünschten Endpunkt läuft. Falls man versehentlich den falschen Startpunkt gewählt hat, kann man mit **Ctrl** die Richtung korrigieren, ohne die Punkte neu zu setzen.

---

## 2. Mathematische Grundlagen

Gegeben:
- \( P_{start} \) – Startpunkt
- \( O \) – Mittelpunkt
- \( P_{end\_pick} \) – vom Benutzer angegebener Endpunkt (nur Richtungsgeber)

### Radius
\[
R = \sqrt{(P_{start.x} - O.x)^2 + (P_{start.y} - O.y)^2}
\]

### Winkel
\[
\begin{align*}
\text{angleStart} &= \operatorname{atan2}(P_{start.y} - O.y,\ P_{start.x} - O.x) \\
\text{angleEndPick} &= \operatorname{atan2}(P_{end\_pick.y} - O.y,\ P_{end\_pick.x} - O.x)
\end{align*}
\]

### Tatsächlicher Endpunkt
Der echte Endpunkt des Bogens liegt auf dem Kreis in der Richtung von `angleEndPick`:

\[
\begin{align*}
P_{end.x} &= O.x + R \cdot \cos(\text{angleEndPick}) \\
P_{end.y} &= O.y + R \cdot \sin(\text{angleEndPick})
\end{align*}
\]

### Sweep-Richtung
- Standard: **counter-clockwise** (von `angleStart` nach `angleEndPick` in positiver Winkelrichtung)
- Mit Ctrl: **clockwise**

Man normalisiert die Winkel (0 … 2π) und berechnet den Sweep-Winkel entsprechend der gewählten Richtung. Der Sweep ist immer der kleinere oder der vom Benutzer gewünschte Bogen (abhängig von der Richtung).

---

## 3. Empfohlene Umsetzung in der Software

### Datenstruktur
Kann identisch zur Three-Point-Variante sein:

```text
struct Arc {
    Point center;
    double radius;
    double startAngle;      // Radiant
    double endAngle;        // Radiant
    bool counterClockwise;  // true = CCW (Standard)
}
```

### Ablauf des Befehls (State Machine)
1. **Zustand: Startpunkt**  
   Benutzer wählt \( P_{start} \)

2. **Zustand: Mittelpunkt**  
   Benutzer wählt \( O \)  
   → Radius wird sofort berechnet und kann angezeigt werden

3. **Zustand: Endpunkt (mit Live-Preview)**  
   - Bei Mausbewegung: temporären Bogen von Start über den aktuellen Winkel zeichnen  
   - **Ctrl-Taste** abfragen → Richtung umkehren  
   - Bei Klick: Bogen finalisieren

### Pseudocode
```python
def createStartCenterEndArc(start, center, endPick, clockwise=False):
    radius = distance(start, center)
    if radius < epsilon:
        return None  # ungültig

    angleStart = atan2(start.y - center.y, start.x - center.x)
    angleEnd   = atan2(endPick.y - center.y, endPick.x - center.x)

    # Richtung
    counterClockwise = not clockwise

    # Optional: Sweep normalisieren
    # (abhängig davon, wie deine Rendering-Engine die Winkel interpretiert)

    return Arc(
        center=center,
        radius=radius,
        startAngle=angleStart,
        endAngle=angleEnd,
        counterClockwise=counterClockwise
    )
```

### Rendering-Hinweis
Die meisten Grafik-APIs (Canvas, Skia, Cairo, Direct2D etc.) unterstützen direkt:

```text
arc(centerX, centerY, radius, startAngle, endAngle, anticlockwise)
```

Wichtig: Die Winkel müssen im Bogenmaß und meist relativ zur positiven X-Achse angegeben werden.

### Empfohlene Features
- Live-Radius-Anzeige nach Auswahl des Mittelpunkts
- Visuelle Hervorhebung der aktuellen Richtung (CCW/CW)
- Unterstützung von Object Snaps (Endpoint, Midpoint, Center, Intersection, Nearest)
- Optional: Eingabe des Endwinkels über die Tastatur (numerisch)
- Grip-Editierung: Startpunkt, Endpunkt und Mittelpunkt nachträglich verschiebbar

---

## 4. Unterschiede zum Three-Point Arc

| Eigenschaft          | 3-Point Arc                  | Start, Center, End              |
|----------------------|------------------------------|---------------------------------|
| Radius               | automatisch berechnet        | durch Start–Center festgelegt   |
| Richtung             | frei (abhängig von Punkten)  | standardmäßig CCW, Ctrl = CW    |
| Endpunkt             | liegt genau auf dem Bogen    | nur Richtungsgeber              |
| Typischer Einsatz    | freies Skizzieren, Tracing   | bekannter Mittelpunkt (Türen, Kreise) |

---

## 5. Zusammenfassung der Implementierungsschritte

1. Command „StartCenterEnd“ oder Option im ARC-Befehl anlegen.
2. Drei Eingaben abfragen: Start → Center → End (mit dynamischer Vorschau).
3. Radius = Abstand Start–Center berechnen.
4. Start- und Endwinkel bestimmen.
5. Richtung (CCW/CW) über Ctrl-Taste steuern.
6. Arc-Objekt speichern und rendern.

Mit dieser Methode lässt sich das AutoCAD-Verhalten sehr genau nachbilden.

---

*Erstellt als Referenz für die eigene CAD-Entwicklung.*
