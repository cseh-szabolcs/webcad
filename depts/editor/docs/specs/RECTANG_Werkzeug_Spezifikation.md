# Rechteckwerkzeug (RECTANG) – Spezifikation für CAD-Editor

**Ziel:** Implementierung des Rechteckwerkzeugs analog zum AutoCAD-Befehl `RECTANG` / Alias `REC`.  
Das Werkzeug erzeugt immer eine **geschlossene Polylinie** (Lightweight Polyline).  
Ein Quadrat ist kein eigener Objekttyp, sondern einfach ein Rechteck mit gleichen Seitenlängen.

Bereits implementierte Systeme, mit denen das Werkzeug interagieren muss:

- Objektfang (OSNAP)
- Polar Tracking
- Object Snap Tracking (OST / OTRACK)
- Dynamic Input

---

## 1. Aufruf

| Methode              | Verhalten                          |
|----------------------|------------------------------------|
| Befehl `RECTANG`     | Startet das Werkzeug               |
| Alias `REC`          | Startet das Werkzeug               |
| Toolbar / Ribbon     | Startet das Werkzeug               |

---

## 2. Befehlsablauf & Prompts

### 2.1 Erster Prompt

**Aktuelle Einstellungen:** `Rotation = 0` (oder aktueller Wert)

**Prompt:**  
`Specify first corner point or [Chamfer/Elevation/Fillet/Thickness/Width]:`

### 2.2 Nach dem ersten Eckpunkt

**Prompt:**  
`Specify other corner point or [Area/Dimensions/Rotation]:`

---

## 3. Erstellungsmethoden (nach erstem Eckpunkt)

### 3.1 Other Corner Point (Default)

- Zweiten diagonal gegenüberliegenden Eckpunkt angeben (Mausklick, OSNAP, Tracking, Koordinaten oder Direct Distance).
- Rechteck wird sofort erstellt und der Befehl beendet.

### 3.2 Dimensions

**Option:** `D` / `Dimensions`

1. Länge angeben
2. Breite angeben
3. Mit dem Cursor die gewünschte Ausrichtung (Quadrant) wählen und klicken

→ Rechteck mit exakter Länge und Breite.

### 3.3 Area

**Option:** `A` / `Area`

1. Fläche angeben
2. Länge oder Breite angeben (`L` oder `W`)
3. Die fehlende Dimension wird berechnet
4. Mit dem Cursor die Ausrichtung wählen

**Hinweis:** Bei aktivem Chamfer oder Fillet fließt deren Effekt in die Flächenberechnung ein.

### 3.4 Rotation

**Option:** `R` / `Rotation`

1. Rotationswinkel angeben (Wert oder zwei Punkte mit Option `P`)
2. Anschließend wie gewohnt den zweiten Eckpunkt, Dimensions oder Area angeben

**Hinweis:** Der gewählte Winkel wird als neuer Default für nachfolgende Rechtecke gespeichert, bis er geändert wird.

---

## 4. Optionen vor dem ersten Eckpunkt

Diese Optionen setzen Einstellungen, die für das aktuelle und nachfolgende Rechtecke gelten (bis sie zurückgesetzt werden):

| Option       | Kürzel | Beschreibung |
|--------------|--------|--------------|
| **Chamfer**  | C      | Setzt die Chamfer-Abstände für alle vier Ecken (erster und zweiter Abstand). |
| **Fillet**   | F      | Setzt den Fillet-Radius für alle vier Ecken. |
| **Width**    | W      | Setzt die Polylinien-Breite des Rechtecks. |
| **Elevation**| E      | Setzt die Z-Höhe (Elevation) des Rechtecks. Default 0. |
| **Thickness**| T      | Setzt die Dicke (Extrusion in Z-Richtung). Default 0. |

**Wichtige Hinweise:**
- Chamfer und Fillet schließen sich gegenseitig aus (einer wird auf 0 gesetzt, wenn der andere aktiviert wird).
- Width, Elevation und Thickness bleiben als Default erhalten, bis sie geändert werden.
- Bei Width > 0 wird die Polylinie mit der angegebenen Breite gezeichnet.

---

## 5. Visuelle Rückmeldung

- Dynamische Vorschau des Rechtecks während der Eingabe des zweiten Punkts / der Dimensionen
- Bei aktivem Chamfer oder Fillet: Vorschau mit den abgerundeten oder abgeschrägten Ecken
- Bei Width > 0: Vorschau mit der angegebenen Linienbreite
- OSNAP-Marker, Polar Tracking und Object Snap Tracking bei Punktangaben
- Dynamic Input für Längen, Breiten und Winkel

---

## 6. Beenden des Befehls

- Nach erfolgreicher Erstellung des Rechtecks wird der Befehl automatisch beendet.
- Esc bricht den Befehl ab (ohne Objekt zu erzeugen).

---

## 7. Objekttyp und Besonderheiten

| Aspekt              | Verhalten |
|---------------------|-----------|
| Objekttyp           | Immer eine **geschlossene Polylinie** |
| Quadrat             | Rechteck mit Länge = Breite (kein eigener Objekttyp) |
| Ecken               | Standardmäßig rechteckig; optional mit Fillet oder Chamfer |
| Breite              | Kann über Width-Option gesetzt werden |
| 3D-Eigenschaften    | Elevation und Thickness möglich |

---

## 8. Interaktion mit bestehenden Systemen

| System                  | Wirkung auf RECTANG                      |
|-------------------------|------------------------------------------|
| **Objektfang (OSNAP)**  | Präzise Eckpunkte                        |
| **Polar Tracking**      | Exakte horizontale/vertikale oder gedrehte Ausrichtung |
| **Object Snap Tracking**| Ausrichtung an bestehenden Objekten      |
| **Dynamic Input**       | Eingabe von Längen, Breiten und relativen Koordinaten am Cursor |

**Direct Distance Entry** und relative Koordinaten (`@x,y`) sind bei der Angabe des zweiten Eckpunkts möglich.

---

## 9. Technische Hinweise für die Implementierung

- Das erzeugte Objekt ist eine geschlossene Polylinie mit 4 Vertices (bzw. mehr bei Fillet/Chamfer).
- Bei Fillet werden die Ecken durch Bogen-Segmente ersetzt.
- Bei Chamfer werden die Ecken durch gerade Segmenten abgeschrägt.
- Rotation wird auf die gesamte Geometrie angewendet.
- Die aktuellen Einstellungen (Chamfer, Fillet, Width, Elevation, Thickness, Rotation) sollten als Defaults gespeichert und bei der nächsten Nutzung wieder verwendet werden.
- Alle Punktabfragen müssen OSNAP, Polar Tracking, Object Snap Tracking und Dynamic Input unterstützen.

---

## 10. Beispielabläufe

### Einfaches Rechteck (zwei Ecken)
```
Command: REC
Specify first corner point or [Chamfer/Elevation/Fillet/Thickness/Width]: (Punkt 1)
Specify other corner point or [Area/Dimensions/Rotation]: (Punkt 2)
```

### Rechteck mit Dimensions
```
Command: REC
Specify first corner point or [...]: (Punkt)
Specify other corner point or [Area/Dimensions/Rotation]: D
Specify length for rectangles: 100
Specify width for rectangles: 50
Specify other corner point or [...]: (Quadrant wählen)
```

### Rechteck mit Fillet
```
Command: REC
Specify first corner point or [Chamfer/Elevation/Fillet/Thickness/Width]: F
Specify fillet radius for rectangles: 5
Specify first corner point or [...]: (Punkt 1)
Specify other corner point or [...]: (Punkt 2)
```

### Quadrat (über Dimensions mit gleichen Werten)
```
Command: REC
Specify first corner point: (Punkt)
Specify other corner point or [...]: D
Specify length for rectangles: 50
Specify width for rectangles: 50
Specify other corner point: (Quadrant)
```

---

**Status:** Spezifikation bereit für die Implementierung des Rechteckwerkzeugs.  
Ein separates Quadrat-Werkzeug ist nicht erforderlich – ein Quadrat entsteht automatisch, wenn Länge und Breite gleich sind.
