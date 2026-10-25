# Linienwerkzeug (LINE) – Spezifikation für CAD-Editor

**Ziel:** Implementierung des Linienwerkzeugs analog zum AutoCAD-Befehl `LINE` / Alias `L`.  
Das Werkzeug erzeugt eine Serie von zusammenhängenden, aber **einzeln editierbaren** Liniensegmenten.

Bereits implementierte Systeme, mit denen das Linienwerkzeug interagieren muss:

- Objektfang (OSNAP)
- Polar Tracking
- Object Snap Tracking (OST / OTRACK)
- Dynamic Input

---

## 1. Aufruf

| Methode              | Verhalten                          |
|----------------------|------------------------------------|
| Befehl `LINE`        | Startet das Werkzeug               |
| Alias `L`            | Startet das Werkzeug               |
| Toolbar / Ribbon     | Startet das Werkzeug               |
| Wiederholung         | Enter/Leertaste nach Abschluss wiederholt den letzten Befehl |

---

## 2. Befehlsablauf & Prompts

### 2.1 Erster Punkt

**Prompt:** `Specify first point:`

Mögliche Eingaben:

- Mausklick (mit aktivem OSNAP, Polar Tracking, Object Snap Tracking)
- Koordinateneingabe (absolut oder relativ)
- **Enter** (ohne Punkt): Fortsetzung vom Endpunkt des zuletzt erstellten Linien-, Polylinien- oder Bogenobjekts.
  - Bei einem Bogen wird die Linie **tangential** zum Bogen angesetzt.

### 2.2 Weitere Punkte

**Prompt:** `Specify next point or [Undo]:`  
(ab dem zweiten Segment zusätzlich: `[Close/Undo]`)

- Mausklick oder Koordinateneingabe → Segment wird erzeugt, Prompt wiederholt sich.
- **Undo / U** → letztes Segment wird entfernt, Prompt bleibt aktiv.
- **Close / C** → schließt die Kontur vom aktuellen Punkt zum ersten Punkt der Serie und beendet den Befehl.  
  (Nur verfügbar, wenn mindestens zwei Segmente existieren.)
- **Enter / Leertaste / Rechtsklick** → beendet den Befehl.
- **Esc** → beendet den Befehl (ohne Close).

---

## 3. Punkt-Eingabemethoden

### 3.1 Direkter Mausklick

Der Cursor wird von den bereits implementierten Systemen beeinflusst:

| System                  | Wirkung auf LINE                          |
|-------------------------|-------------------------------------------|
| **Objektfang (OSNAP)**  | Snap auf Endpunkte, Mittelpunkte, Schnittpunkte etc. |
| **Polar Tracking**      | Temporäre Führungslinien bei definierten Winkeln (z. B. 15°, 30°, 45°, 90°). Direct Distance Entry möglich. |
| **Object Snap Tracking**| Tracking-Vektoren von OSNAP-Punkten. Mehrere Tracking-Punkte können gleichzeitig aktiv sein. |
| **Dynamic Input**       | Anzeige von Länge und Winkel am Cursor. Eingabe über Tooltips. |

### 3.2 Direct Distance Entry

1. Cursor in gewünschte Richtung bewegen (unterstützt durch Polar Tracking).
2. Numerischen Wert eingeben (Länge).
3. Enter → Punkt wird in der aktuellen Cursorrichtung in der angegebenen Distanz gesetzt.

### 3.3 Koordinateneingabe

| Typ                  | Dynamic Input **an**          | Dynamic Input **aus**         |
|----------------------|-------------------------------|-------------------------------|
| Absolut              | `#x,y`                        | `x,y`                         |
| Relativ (kartesisch) | `x,y`                         | `@x,y`                        |
| Relativ (polar)      | `länge<winkel` oder Tab-Wechsel | `@länge<winkel`             |

**Dynamic Input Verhalten (Standard):**
- Pointer Input: relative polare Koordinaten als Default.
- Dimension Input: Länge + Winkel am Cursor, Wechsel mit **Tab**.
- Dynamic Prompts: Befehlsoptionen werden am Cursor angezeigt.

---

## 4. Visuelle Rückmeldung während des Befehls

- **Rubber-Band-Linie**: Temporäre Vorschau vom letzten gesetzten Punkt zum aktuellen Cursor (inkl. aller Tracking- und Polar-Hilfslinien).
- **Dynamic Input Tooltips**: Länge, Winkel, optionale absolute/relative Koordinaten.
- **OSNAP-Marker & Tooltips**: Standard-Marker der bereits implementierten Objektfang-Funktion.
- **Tracking-Linien**: Gestrichelte Linien bei Polar Tracking und Object Snap Tracking.

---

## 5. Optionen im Detail

### Undo (U)
- Entfernt das zuletzt erzeugte Liniensegment.
- Kann mehrfach hintereinander aufgerufen werden.
- Der erste Punkt der Serie bleibt erhalten, solange noch Segmente existieren.

### Close (C)
- Erzeugt ein abschließendes Segment vom aktuellen Punkt zum ersten Punkt der aktuellen Serie.
- Beendet den LINE-Befehl.
- Nur verfügbar, wenn mindestens zwei Segmente gezeichnet wurden.

---

## 6. Beenden des Befehls

| Aktion                    | Ergebnis                                      |
|---------------------------|-----------------------------------------------|
| Enter / Leertaste         | Befehl beenden, alle Segmente bleiben         |
| Rechtsklick (Standard)    | Befehl beenden                                |
| Esc                       | Befehl abbrechen (letzte unvollständige Aktion verwerfen) |
| Close (C)                 | Schließen + Beenden                           |

---

## 7. Interaktion mit bestehenden Systemen (Zusammenfassung)

1. **Objektfang**  
   Wird bei jeder Punktabfrage aktiv. Priorität vor freiem Cursor.

2. **Polar Tracking**  
   Beeinflusst die Richtung der Rubber-Band-Linie und ermöglicht Direct Distance Entry bei exakten Winkeln.

3. **Object Snap Tracking**  
   Ermöglicht das Anfahren virtueller Punkte durch Hover über OSNAP-Punkte (ohne Klick). Tracking-Vektoren werden mit Polar Tracking kombiniert.

4. **Dynamic Input**  
   - Zeigt Länge und Winkel der aktuellen Rubber-Band-Linie.  
   - Erlaubt direkte Eingabe von Länge (Enter) oder Länge + Winkel (Tab).  
   - Ändert das Default-Verhalten der Koordinateneingabe (relativ vs. absolut).

---

## 8. Technische Hinweise für die Implementierung

- Jedes Segment ist ein eigenständiges Linienobjekt (nicht eine Polylinie).
- Die Serie merkt sich den Startpunkt der aktuellen LINE-Sequenz für die Close-Option.
- Bei „Continue from last“ muss das zuletzt erstellte Objekt (Line, Polyline, Arc) abgefragt werden.
- Bei Arc: Startpunkt = Endpunkt des Bogens, Richtung = Tangente.
- Undo während des Befehls ist unabhängig vom globalen Undo-Stack (nur lokal innerhalb der LINE-Sequenz).
- Alle Punktabfragen müssen die bestehenden Snap-/Tracking-/Dynamic-Input-Systeme aufrufen.

---

## 9. Beispielablauf

```
Command: L
Specify first point: (Klick auf OSNAP Endpoint)
Specify next point or [Undo]: (Polar 45° + Direct Distance 100)
Specify next point or [Close/Undo]: (Object Snap Tracking von Midpoint + Klick)
Specify next point or [Close/Undo]: C
```

---

**Status:** Spezifikation bereit für die Implementierung des ersten Zeichenwerkzeugs.
