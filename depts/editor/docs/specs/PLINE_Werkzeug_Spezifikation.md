# Polylinienwerkzeug (PLINE) – Spezifikation für CAD-Editor

URL: https://help.autodesk.com/view/ACD/2026/ENU/?guid=GUID-11883C70-6435-4F80-8FB4-F6E933B8FD94

**Ziel:** Implementierung des Polylinienwerkzeugs analog zum AutoCAD-Befehl `PLINE` / Alias `PL`.  
Das Werkzeug erzeugt **ein einziges Objekt** (Polyline), das aus verbundenen Linien- und optional Bogen-Segmenten besteht.

Bereits implementierte Systeme, mit denen das Polylinienwerkzeug interagieren muss:

- Objektfang (OSNAP)
- Polar Tracking
- Object Snap Tracking (OST / OTRACK)
- Dynamic Input

---

## 1. Aufruf

| Methode              | Verhalten                          |
|----------------------|------------------------------------|
| Befehl `PLINE`       | Startet das Werkzeug               |
| Alias `PL`           | Startet das Werkzeug               |
| Toolbar / Ribbon     | Startet das Werkzeug               |
| Wiederholung         | Enter/Leertaste nach Abschluss wiederholt den letzten Befehl |

---

## 2. Befehlsablauf & Prompts

### 2.1 Startpunkt

**Prompt:** `Specify start point:`

- Mausklick (mit OSNAP, Polar Tracking, Object Snap Tracking)
- Koordinateneingabe
- **Enter** (ohne Punkt): Fortsetzung vom Endpunkt des zuletzt erstellten Objekts (Polyline, Line oder Arc)

**Hinweis:** Ein temporäres Markierungskreuz (+) erscheint am Startpunkt.

**Zusatzinfo:**  
`Current line-width is 0.0000` (oder aktueller Standardwert)

### 2.2 Weitere Punkte (Linienmodus – Default)

**Prompt:**  
`Specify next point or [Arc/Halfwidth/Length/Undo/Width]:`  
(ab dem zweiten Segment zusätzlich `Close` verfügbar)

- Punkt angeben → Liniensegment wird hinzugefügt, Prompt wiederholt sich
- Optionen siehe unten

---

## 3. Gemeinsame Optionen (Linien- und Bogenmodus)

| Option       | Kürzel | Beschreibung |
|--------------|--------|--------------|
| **Close**    | C      | Verbindet den aktuellen Punkt mit dem Startpunkt und schließt die Polyline. Beendet den Befehl. |
| **Halfwidth**| H      | Gibt die halbe Breite (von der Mittellinie bis zum Rand) an. |
| **Width**    | W      | Gibt die volle Breite des nächsten Segments an (Start- und Endbreite). |
| **Undo**     | U      | Entfernt das zuletzt hinzugefügte Segment. |

### Breitenverhalten (Width / Halfwidth)

- Startbreite wird zur Default-Endbreite.
- Endbreite wird zur einheitlichen Breite aller folgenden Segmente, bis sie erneut geändert wird.
- Start- und Endpunkt liegen auf der Mittellinie.
- An den Verbindungen werden Segmente normalerweise abgeschrägt (mitered).
- Keine Abschrägung bei nicht-tangentialen Bögen, sehr spitzen Winkeln oder bestimmten Linientypen.

---

## 4. Optionen nur im Linienmodus

| Option   | Kürzel | Beschreibung |
|----------|--------|--------------|
| **Arc**  | A      | Wechselt in den Bogenmodus. Der nächste Bogen startet tangential zum vorherigen Segment. |
| **Length**| L     | Erzeugt ein Segment mit angegebener Länge im gleichen Winkel wie das vorherige Segment. Bei vorherigem Bogen ist die Linie tangential. |

---

## 5. Bogenmodus (Arc)

Nach Eingabe von `A` wechselt der Prompt zu:

**Prompt:**  
`Specify endpoint of arc or [Angle/CEnter/Direction/Halfwidth/Line/Radius/Second pt/Undo/Width]:`

| Option          | Kürzel | Beschreibung |
|-----------------|--------|--------------|
| **Endpoint**    | (Default) | Endpunkt des Bogens. Bogen ist tangential zum vorherigen Segment. |
| **Angle**       | A      | Eingeschlossener Winkel. Positiv = gegen den Uhrzeigersinn, negativ = im Uhrzeigersinn. |
| **CEnter**      | CE     | Mittelpunkt des Bogens (Achtung: `CE` für die Option, `CEN` für OSNAP Center). |
| **Direction**   | D      | Starttangente des Bogens festlegen. |
| **Line**        | L      | Zurück in den Linienmodus. |
| **Radius**      | R      | Radius des Bogens. |
| **Second pt**   | S      | Zweiter Punkt für 3-Punkt-Bogen. |
| **Undo**        | U      | Letztes Segment entfernen. |
| **Width**       | W      | Breite für das nächste Segment. |
| **Halfwidth**   | H      | Halbe Breite. |
| **Close**       | CL     | Schließt mit einem Bogen (falls möglich). |

---

## 6. Punkt-Eingabemethoden

Die Punktabfragen nutzen dieselben Systeme wie beim LINE-Befehl:

| System                  | Wirkung auf PLINE                         |
|-------------------------|-------------------------------------------|
| **Objektfang (OSNAP)**  | Snap auf Endpunkte, Mittelpunkte, Schnittpunkte etc. |
| **Polar Tracking**      | Führungslinien bei definierten Winkeln + Direct Distance Entry |
| **Object Snap Tracking**| Tracking-Vektoren von OSNAP-Punkten |
| **Dynamic Input**       | Länge/Winkel am Cursor, Tab-Wechsel, relative Koordinaten als Default |

**Direct Distance Entry** und Koordinateneingabe verhalten sich identisch zu LINE (inkl. `#` für absolute Koordinaten bei Dynamic Input).

---

## 7. Visuelle Rückmeldung

- **Rubber-Band** vom letzten Vertex zum aktuellen Cursor (Linie oder Bogen-Vorschau je nach Modus)
- **Temporäres Markierungskreuz** am Startpunkt
- **Dynamic Input Tooltips** (Länge, Winkel, Optionen)
- **OSNAP-Marker** und Tracking-Linien (Polar + Object Snap Tracking)
- Breiten-Vorschau, falls Width ≠ 0

---

## 8. Beenden des Befehls

| Aktion                    | Ergebnis                                      |
|---------------------------|-----------------------------------------------|
| Enter / Leertaste         | Befehl beenden, offene Polyline bleibt        |
| Rechtsklick (Standard)    | Befehl beenden                                |
| Esc                       | Befehl abbrechen                              |
| Close (C)                 | Schließen + Beenden                           |

---

## 9. Wichtige Unterschiede zu LINE

| Aspekt              | LINE                          | PLINE                                      |
|---------------------|-------------------------------|--------------------------------------------|
| Objekttyp           | Mehrere einzelne Linien       | Ein einziges Polylinien-Objekt             |
| Segmenttypen        | Nur Linien                    | Linien + Bögen                             |
| Breite              | Keine                         | Start-/Endbreite pro Segment möglich       |
| Close               | Erzeugt eine zusätzliche Linie| Schließt die Polyline                      |
| Editierbarkeit      | Jedes Segment einzeln         | Gesamtes Objekt (Grips, PEDIT etc.)        |
| Continue from last  | Ja                            | Ja                                         |

---

## 10. Technische Hinweise für die Implementierung

- Die Polyline speichert eine Liste von Vertices (mit optionaler Bulge für Bögen).
- Jeder Vertex kann eine Start- und Endbreite haben.
- Closed-Flag wird bei Close gesetzt.
- Undo während des Befehls entfernt nur den letzten Vertex (lokal innerhalb der PLINE-Sequenz).
- Alle Punktabfragen müssen OSNAP, Polar Tracking, Object Snap Tracking und Dynamic Input unterstützen.
- Bei Arc-Modus muss die Vorschau einen Kreisbogen darstellen.
- Tangentialität beim Wechsel von Linie → Bogen und Bogen → Linie beachten.
- PLINETYPE-Systemvariable (Lightweight vs. Legacy) kann optional berücksichtigt werden (Standard: Lightweight).

---

## 11. Beispielablauf

```
Command: PL
Specify start point: (OSNAP Endpoint)
Current line-width is 0.0000
Specify next point or [Arc/Halfwidth/Length/Undo/Width]: (Polar 0° + 100)
Specify next point or [Arc/Close/Halfwidth/Length/Undo/Width]: A
Specify endpoint of arc or [Angle/CEnter/...]: (Punkt)
Specify endpoint of arc or [...]: L
Specify next point or [...]: W
Specify starting width <0.0000>: 2
Specify ending width <2.0000>: 0
Specify next point or [...]: (Punkt)
Specify next point or [Arc/Close/...]: C
```

---

**Status:** Spezifikation bereit für die Implementierung des Polylinienwerkzeugs.
