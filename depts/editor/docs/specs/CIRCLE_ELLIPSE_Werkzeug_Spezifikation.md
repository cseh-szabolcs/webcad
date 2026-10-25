# Kreis- und Ellipsenwerkzeug – Spezifikation für CAD-Editor

**Ziel:** Implementierung der Zeichenwerkzeuge **CIRCLE** und **ELLIPSE** analog zu AutoCAD.  
Beide Werkzeuge erzeugen jeweils ein einzelnes Objekt.

Bereits implementierte Systeme, mit denen beide Werkzeuge interagieren müssen:

- Objektfang (OSNAP)
- Polar Tracking
- Object Snap Tracking (OST / OTRACK)
- Dynamic Input

---

## Teil 1: Kreiswerkzeug (CIRCLE)

### 1.1 Aufruf

| Methode              | Verhalten                          |
|----------------------|------------------------------------|
| Befehl `CIRCLE`      | Startet das Werkzeug               |
| Alias `C` oder `CI`  | Startet das Werkzeug               |
| Toolbar / Ribbon     | Startet das Werkzeug (mit Dropdown für Methoden) |

### 1.2 Standardprompt

**Prompt:**  
`Specify center point for circle or [3P/2P/Ttr (tan tan radius)]:`

**Default-Methode:** Center + Radius

### 1.3 Methoden

#### 1.3.1 Center, Radius (Default)

1. Mittelpunkt angeben (Mausklick, OSNAP, Tracking, Koordinaten)
2. **Prompt:** `Specify radius of circle or [Diameter]:`
   - Wert eingeben oder Punkt anklicken (Abstand = Radius)
   - Option `D` / `Diameter` → wechselt zu Durchmesser-Eingabe

**Direct Distance Entry** und Dynamic Input sind hier voll nutzbar.

#### 1.3.2 Center, Diameter

1. Mittelpunkt angeben
2. Option `D` wählen
3. **Prompt:** `Specify diameter of circle:`
   - Wert oder zweiter Punkt (Abstand = Durchmesser)

#### 1.3.3 3P (Three Points)

**Option:** `3P`

1. Ersten Punkt auf dem Umfang angeben
2. Zweiten Punkt angeben
3. Dritten Punkt angeben  
→ Kreis durch alle drei Punkte

#### 1.3.4 2P (Two Points)

**Option:** `2P`

1. Ersten Endpunkt des Durchmessers angeben
2. Zweiten Endpunkt des Durchmessers angeben  
→ Kreis mit diesen beiden Punkten als Durchmesser-Endpunkte

#### 1.3.5 TTR (Tangent, Tangent, Radius)

**Option:** `TTR` oder `Ttr`

1. Erstes Objekt auswählen (Tangente)
2. Zweites Objekt auswählen (Tangente)
3. Radius angeben  

**Hinweis:**  
- Es wird der Kreis mit dem angegebenen Radius gezeichnet, dessen Tangentialpunkte am nächsten zu den Auswahlpunkten liegen.
- Bei mehreren möglichen Lösungen wird die nächstgelegene gewählt.
- Schlägt fehl, wenn kein passender Kreis existiert.

#### 1.3.6 Tan, Tan, Tan (TTT)

(In manchen Versionen nur über Ribbon/Dropdown verfügbar)

1. Erstes Objekt auswählen
2. Zweites Objekt auswählen
3. Drittes Objekt auswählen  
→ Kreis, der zu allen drei Objekten tangential ist.

### 1.4 Visuelle Rückmeldung

- Dynamische Vorschau des Kreises während der Radius-/Durchmesser-Angabe
- OSNAP-Marker und Tracking-Linien bei Punktangaben
- Dynamic Input zeigt Radius bzw. Durchmesser

### 1.5 Beenden

- Nach erfolgreicher Erstellung wird der Befehl automatisch beendet.
- Esc bricht ab.

---

## Teil 2: Ellipsenwerkzeug (ELLIPSE)

### 2.1 Aufruf

| Methode              | Verhalten                          |
|----------------------|------------------------------------|
| Befehl `ELLIPSE`     | Startet das Werkzeug               |
| Alias `EL`           | Startet das Werkzeug               |
| Toolbar / Ribbon     | Startet das Werkzeug (mit Dropdown) |

### 2.2 Standardprompt

**Prompt:**  
`Specify axis endpoint of ellipse or [Arc/Center]:`

**Default-Methode:** Axis Endpoint (zwei Endpunkte der ersten Achse)

### 2.3 Methoden

#### 2.3.1 Axis Endpoint (Default)

1. Ersten Endpunkt der ersten Achse angeben
2. Zweiten Endpunkt der ersten Achse angeben  
   (Winkel und Länge der ersten Achse sind damit festgelegt)
3. **Prompt:** `Specify distance to other axis or [Rotation]:`
   - Punkt anklicken oder Wert eingeben (Abstand vom Mittelpunkt der ersten Achse)
   - Option `R` / `Rotation`: Drehung eines Kreises um die erste Achse (0° = Kreis, höhere Werte = stärkere Exzentrizität)

**Hinweis:** Die erste Achse kann sowohl die Haupt- als auch die Nebenachse sein.

#### 2.3.2 Center

**Option:** `C` / `Center`

1. Mittelpunkt der Ellipse angeben
2. Endpunkt der ersten Achse angeben (entspricht dem Radius der ersten Achse)
3. Abstand zur zweiten Achse oder Rotation angeben (wie oben)

#### 2.3.3 Arc (Elliptischer Bogen)

**Option:** `A` / `Arc`

1. Ellipse wie oben definieren (Axis Endpoint oder Center)
2. Startwinkel des Bogens angeben
3. Endwinkel des Bogens angeben  

→ Es wird nur der Bogen-Abschnitt der Ellipse erzeugt.

### 2.4 Visuelle Rückmeldung

- Dynamische Vorschau der Ellipse (oder des Bogens) während der Eingabe
- Polar Tracking und Object Snap Tracking für Achsenrichtungen
- Dynamic Input für Längen und Winkel
- OSNAP für alle Punktangaben

### 2.5 Beenden

- Nach erfolgreicher Erstellung wird der Befehl automatisch beendet.
- Esc bricht ab.

---

## Teil 3: Gemeinsame Interaktion mit bestehenden Systemen

| System                  | Wirkung auf CIRCLE & ELLIPSE                  |
|-------------------------|-----------------------------------------------|
| **Objektfang (OSNAP)**  | Präzise Punkte für Mittelpunkte, Achsenendpunkte, Umfangspunkte |
| **Polar Tracking**      | Exakte Winkel für Achsen und Richtungen       |
| **Object Snap Tracking**| Ausrichtung an bestehenden Objekten           |
| **Dynamic Input**       | Eingabe von Radien, Durchmessern, Achsenlängen und Winkeln am Cursor (Tab-Wechsel) |

**Direct Distance Entry** ist bei allen Abstandsangaben (Radius, Durchmesser, Achsenlänge) möglich.

---

## Teil 4: Technische Hinweise für die Implementierung

### Kreis
- Speichert Mittelpunkt + Radius (oder Durchmesser intern umgerechnet).
- Bei 3P/2P/TTR muss die Geometrie berechnet werden.
- TTR und TTT erfordern Tangentialitätsberechnung an bestehende Objekte.

### Ellipse
- Speichert Mittelpunkt, Hauptachsenlänge, Nebenachsenlänge und Rotationswinkel.
- Elliptischer Bogen speichert zusätzlich Start- und Endwinkel.
- Rotation-Option berechnet die Exzentrizität aus dem Drehwinkel.

### Gemeinsam
- Alle Punktabfragen müssen die bestehenden Snap-/Tracking-/Dynamic-Input-Systeme nutzen.
- Dynamische Vorschau während der Eingabe ist wichtig für die Benutzerfreundlichkeit.
- Beide Objekte sind einzelne Entities (nicht aus Segmenten zusammengesetzt).

---

## Teil 5: Beispielabläufe

### Kreis (Center + Radius)
```
Command: C
Specify center point for circle or [3P/2P/Ttr]: (OSNAP)
Specify radius of circle or [Diameter]: 25
```

### Kreis (TTR)
```
Command: C
Specify center point for circle or [3P/2P/Ttr]: TTR
Specify point on object for first tangent of circle: (Objekt 1)
Specify point on object for second tangent of circle: (Objekt 2)
Specify radius of circle: 15
```

### Ellipse (Axis Endpoint)
```
Command: EL
Specify axis endpoint of ellipse or [Arc/Center]: (Punkt 1)
Specify other endpoint of axis: (Punkt 2)
Specify distance to other axis or [Rotation]: 10
```

### Ellipse (Center + Arc)
```
Command: EL
Specify axis endpoint of ellipse or [Arc/Center]: C
Specify center of ellipse: (Mittelpunkt)
Specify endpoint of axis: (Endpunkt)
Specify distance to other axis or [Rotation]: R
Specify rotation around major axis: 30
Specify start angle or [Parameter]: 0
Specify end angle or [Parameter/Included angle]: 180
```

---

**Status:** Spezifikation für Kreis und Ellipse bereit für die Implementierung.
