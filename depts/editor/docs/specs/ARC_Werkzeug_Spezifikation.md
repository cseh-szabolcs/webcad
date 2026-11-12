# Three-Point Arc in AutoCAD und Umsetzung in eigener CAD-Software

## 1. Funktionsweise in AutoCAD

### Grundprinzip
Der **3-Point Arc** (auch „Three Points“ oder „3P“) ist die Standard-Methode des ARC-Befehls in AutoCAD.  
Es wird ein Kreisbogen erzeugt, der **exakt durch drei angegebene Punkte** verläuft.

- **Punkt 1** = Startpunkt des Bogens  
- **Punkt 2** = beliebiger Punkt, der auf dem Bogen liegen soll (Steuerpunkt / „bulge“-Punkt)  
- **Punkt 3** = Endpunkt des Bogens  

Es gibt genau einen Kreis (und damit genau einen Bogen), der durch drei nicht-kollineare Punkte geht. Die Richtung (im Uhrzeigersinn oder gegen den Uhrzeigersinn) ergibt sich automatisch aus der Reihenfolge der Punkte. Der Bogen wird so gezeichnet, dass er vom Startpunkt über den zweiten Punkt zum Endpunkt verläuft.

### Aufruf in AutoCAD
- Befehl: `ARC` → Option `3P` oder einfach Enter (Standard)
- Ribbon: **Home → Draw → Arc-Dropdown → 3-Point**
- Dynamische Vorschau: Während der Auswahl des dritten Punktes wird der Bogen live angezeigt.

### Wichtige Eigenschaften
- Als einzige Arc-Methode kann der 3-Point-Bogen sowohl **clockwise** als auch **counter-clockwise** erzeugt werden (abhängig von der Punktreihenfolge).
- Die meisten anderen Arc-Methoden (Start-Center-End, Start-End-Angle usw.) zeichnen standardmäßig **gegen den Uhrzeigersinn**.
- Bei kollinearen Punkten gibt es keinen eindeutigen Kreis → AutoCAD erzeugt keinen Bogen (oder eine Fehlermeldung).
- Der zweite Punkt muss **nicht** der Mittelpunkt des Bogens sein. Seine Lage bestimmt den Radius und die Krümmung.

### Unterschied zu anderen Arc-Methoden
| Methode              | Richtung              | Besonderheit                          |
|----------------------|-----------------------|---------------------------------------|
| 3-Point              | frei (CW oder CCW)   | alle drei Punkte liegen auf dem Bogen |
| Start, Center, End   | meist CCW            | Radius = Abstand Start–Center         |
| Start, End, Angle    | meist CCW            | eingeschlossener Winkel               |
| Continue             | tangential           | an letztes Objekt ansetzend           |

---

## 2. Mathematische Grundlagen für die Umsetzung

Gegeben sind drei Punkte \( P_1, P_2, P_3 \).

### Schritt 1: Mittelpunkt und Radius des Kreises bestimmen
Es gibt mehrere robuste Algorithmen. Hier ein bewährter, numerisch stabiler Ansatz (Lösung des linearen Gleichungssystems):

Sei:
- \( A = P_1 \)
- \( B = P_2 \)
- \( C = P_3 \)

Dann gilt für den Mittelpunkt \( O = (O_x, O_y) \):

\[
\begin{align*}
2(B_x - A_x) O_x + 2(B_y - A_y) O_y &= B_x^2 + B_y^2 - A_x^2 - A_y^2 \\
2(C_x - A_x) O_x + 2(C_y - A_y) O_y &= C_x^2 + C_y^2 - A_x^2 - A_y^2
\end{align*}
\]

Dies ist ein 2×2-Gleichungssystem, das mit der Cramerschen Regel oder Gauß-Elimination gelöst wird.

**Radius**:
\[
R = \sqrt{(A_x - O_x)^2 + (A_y - O_y)^2}
\]

**Kolinearitätsprüfung**:  
Wenn der Betrag der Determinante sehr klein ist (z. B. < 1e-10), sind die Punkte (nahezu) kollinear → kein Bogen möglich.

### Schritt 2: Winkel bestimmen
```text
angleStart = atan2(P1.y - O.y, P1.x - O.x)
angleMid   = atan2(P2.y - O.y, P2.x - O.x)
angleEnd   = atan2(P3.y - O.y, P3.x - O.x)
```

### Schritt 3: Richtige Bogenrichtung ermitteln
Der Bogen muss von `angleStart` über `angleMid` nach `angleEnd` verlaufen.

Eine einfache Methode mit orientierten Winkeln (oder Kreuzprodukten):

```text
function isCounterClockwise(start, mid, end):
    return (mid - start) cross (end - start) > 0
```

Oder mit normalisierten Winkeln (0 … 2π):
- Berechne die Sweep-Winkel von Start → Mid und Start → End.
- Wähle die Richtung, in der der Mid-Punkt innerhalb des Sweep liegt.

---

## 3. Empfohlene Umsetzung in der Software

### Datenstruktur für einen Arc
```text
struct Arc {
    Point center;
    double radius;
    double startAngle;   // Radiant
    double endAngle;     // Radiant
    bool counterClockwise;
    // optional: die drei Originalpunkte speichern
}
```

Alternativ (wenn du Polylines mit Bulge verwendest, wie in AutoCAD):
- Startpunkt, Endpunkt und Bulge-Faktor.

### Ablauf des Befehls (State Machine)
1. **Zustand: Startpunkt**  
   → Benutzer klickt \( P_1 \)

2. **Zustand: Zweiter Punkt**  
   → Benutzer klickt \( P_2 \)

3. **Zustand: Endpunkt (mit Live-Preview)**  
   → Bei jeder Mausbewegung:  
     - Berechne Kreis durch \( P_1, P_2, \) aktuelle Mausposition  
     - Zeichne temporären Bogen  
   → Bei Klick: Bogen finalisieren und zur Zeichnung hinzufügen

### Pseudocode für die Kernfunktion
```python
def createThreePointArc(p1, p2, p3):
    # 1. Mittelpunkt und Radius berechnen
    center, radius = circleFromThreePoints(p1, p2, p3)
    if center is None:
        return None  # Punkte kollinear

    # 2. Winkel
    a1 = atan2(p1.y - center.y, p1.x - center.x)
    a2 = atan2(p2.y - center.y, p2.x - center.x)
    a3 = atan2(p3.y - center.y, p3.x - center.x)

    # 3. Richtung bestimmen (so dass a2 zwischen a1 und a3 liegt)
    ccw = isPointOnArc(a1, a2, a3, counterClockwise=True)

    return Arc(center, radius, a1, a3, ccw)
```

### Rendering
- Entweder als `canvas.arc(centerX, centerY, radius, startAngle, endAngle, anticlockwise)`  
- Oder durch Diskretisierung in kurze Liniensegmente (für Export, DXF etc.)

### Empfohlene Verbesserungen
- Numerische Stabilität bei sehr großen Radien (fast kollineare Punkte) beachten.
- Object Snaps (Endpunkt, Mittelpunkt, Intersection, Nearest) unterstützen.
- Undo/Redo berücksichtigen.
- Optional: Grip-Punkte (Start, End, Midpoint) zum nachträglichen Bearbeiten.

---

## 4. Zusammenfassung der Implementierungsschritte

1. Command „ARC“ oder „3PARC“ registrieren.
2. Drei Punkte vom Benutzer abfragen (mit dynamischer Vorschau beim dritten Punkt).
3. Mit dem Algorithmus Mittelpunkt + Radius berechnen.
4. Start-/Endwinkel und Richtung so bestimmen, dass der Bogen durch den mittleren Punkt läuft.
5. Arc-Objekt in der Zeichnungsdatenbank speichern.
6. Rendern und ggf. in DXF/SVG/PDF exportieren.

Damit hast du das Verhalten von AutoCAD sehr genau nachgebildet.

---

*Erstellt als Referenz für die eigene CAD-Entwicklung.*
