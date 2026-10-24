# Spezifikation: Polar Tracking (Polarverfolgung)

## Übersicht

**Polar Tracking** (auch Polarverfolgung) ist eine Zeichenhilfe, die temporäre Ausrichtungspfade (Tracking-Linien) anzeigt, sobald der Cursor in die Nähe eines definierten Winkels relativ zum letzten Bezugspunkt kommt.

Sie funktioniert **unabhängig von Object Snaps** und hilft dem Benutzer, präzise auf geraden Linien (horizontal, vertikal oder in beliebigen Winkeln) zu arbeiten, ohne den Ortho-Modus aktivieren zu müssen.

Typische Einsatzfälle:
- Beim Zeichnen von Linien, Bögen usw.
- Beim Verschieben (MOVE), Kopieren (COPY) oder anderen Modify-Befehlen beim Festlegen des zweiten Punkts
- In Kombination mit Direct Distance Entry

---

## Grundprinzip

1. Der Benutzer befindet sich in einem Befehl, der einen Punkt erwartet (z. B. nach dem Basispunkt beim MOVE).
2. Der letzte Bezugspunkt ist der Startpunkt der aktuellen Operation (beim MOVE: der Basispunkt).
3. Sobald der Cursor innerhalb eines Toleranzbereichs (Aperture) eines Polar-Winkels liegt, erscheint eine **gestrichelte Tracking-Linie** vom Bezugspunkt in Richtung des Cursors.
4. Ein Tooltip zeigt Distanz und Winkel an.
5. Der Punkt, den der Benutzer jetzt klickt (oder per Distanz-Eingabe festlegt), liegt exakt auf dieser Geraden.

---

## Winkel und Einstellungen

### Standard-Winkel
- Standardmäßig: **90°** (also 0°, 90°, 180°, 270° → horizontal und vertikal)
- Weitere vordefinierte Inkremente: 45°, 30°, 22.5°, 15°, 10°, 5° usw.

### Konfigurierbare Optionen
- **Increment Angle**: Der Basis-Schritt (z. B. 45° erzeugt Linien bei 0°, 45°, 90°, 135° …)
- **Additional Angles**: Benutzerdefinierte zusätzliche Winkel (z. B. 30°, 60°)
- **Polar Angle Measurement**:
  - Absolute (bezogen auf das aktuelle UCS)
  - Relative to last segment (bezogen auf die Richtung des letzten gezeichneten Segments)

### Aktivierung
- Statusleisten-Button „Polar“ / „POLAR“
- Tastenkürzel: **F10**
- Polar Tracking und Ortho Mode schließen sich gegenseitig aus (Ortho an → Polar aus und umgekehrt)

---

## Visuelle Darstellung

| Element              | Aussehen                          | Beschreibung |
|----------------------|-----------------------------------|--------------|
| **Tracking-Linie**   | Gestrichelte Linie                | Vom Bezugspunkt in Richtung des Polar-Winkels |
| **Tracking-Marker**  | Kleines Kreuz (x) auf der Linie   | Zeigt die aktuelle Projektion des Cursors |
| **Tooltip**          | Textbox                           | Zeigt Distanz + Winkel (z. B. `125.40 < 45°`) |
| **Farbe**            | Meist Grün oder konfigurierbar    | Hebt sich vom Zeichnungshintergrund ab |

Die Linie bleibt sichtbar, solange der Cursor in der Nähe des Winkels bleibt. Bewegt sich der Cursor zu weit weg, verschwindet sie wieder.

---

## Interaktion

### Normale Nutzung
1. Basispunkt (oder Startpunkt) ist festgelegt.
2. Cursor bewegen → Tracking-Linie erscheint bei passendem Winkel.
3. Klick → Punkt wird auf der Tracking-Linie platziert.

### Direct Distance Entry
1. Tracking-Linie ist sichtbar.
2. Benutzer tippt eine Zahl (z. B. `100`) und bestätigt mit Enter.
3. Der Punkt wird genau um diese Distanz entlang des aktuellen Polar-Winkels gesetzt.
4. Es ist **nicht** nötig, den Winkel zusätzlich einzugeben.

### Weitere Hinweise
- Die Tracking-Linie kann mit der Shift-Taste temporär „gelockt“ werden (in manchen Implementierungen).
- Polar Tracking funktioniert auch in 3D (zusätzliche Z-Ausrichtung möglich).
- Es kann mit Object Snap Tracking kombiniert werden (Schnittpunkte von Polar- und OSNAP-Tracking-Linien).

---

## Ablauf im Kontext des MOVE-Befehls

```
[Basispunkt wurde gewählt]
        ↓
[Zustand: SecondPoint / MovePreview]
        ↓
[Cursor bewegen]
        ↓
[Polar Tracking prüft Winkel zum Basispunkt]
        ↓
[Falls Winkel innerhalb Toleranz → Tracking-Linie + Tooltip anzeigen]
        ↓
[User klickt ODER tippt Distanz]
        ↓
[Zweiter Punkt wird auf der Polar-Linie festgelegt]
        ↓
[Objekte werden um den Vektor (zweiterPunkt − basisPunkt) verschoben]
```

---

## Technische Umsetzungshinweise

### Datenstrukturen

```text
PolarTrackingSettings {
  enabled: bool
  incrementAngle: float          // z. B. 45.0
  additionalAngles: List<float>  // z. B. [30, 60]
  relativeToLastSegment: bool
  tolerance: float               // Winkel-Toleranz in Grad oder Pixel
  lineColor: Color
  showTooltip: bool
}

TrackingState {
  isActive: bool
  currentAngle: float            // aktuell aktiver Polar-Winkel
  referencePoint: Point2D        // Bezugspunkt (Basispunkt)
  projectedPoint: Point2D        // aktuelle Projektion des Cursors
}
```

### Algorithmus (pro Mausbewegung)

1. Berechne den Winkel vom Bezugspunkt (Basispunkt) zum aktuellen Cursor.
2. Normalisiere den Winkel (0–360°).
3. Prüfe, ob der Winkel innerhalb der Toleranz eines gültigen Polar-Winkels liegt  
   (Increment + Additional Angles).
4. Falls ja:
   - Projiziere den Cursor auf die entsprechende Gerade.
   - Zeichne die gestrichelte Tracking-Linie.
   - Zeige Tooltip mit Distanz und Winkel.
   - Setze den effektiven Punkt auf die projizierte Position (für Klick oder Distanz-Eingabe).
5. Falls nein: Keine Tracking-Linie anzeigen.

### Direct Distance Entry
- Wenn eine Tracking-Linie aktiv ist und der Benutzer eine Zahl eingibt:
  - Berechne den Zielpunkt = `referencePoint + (Richtung des Winkels × eingegebene Distanz)`.
  - Verwende diesen Punkt als zweiten Punkt.

---

## Randfälle

- **Sehr kleine Bewegungen**: Tracking sollte nicht sofort flackern (leichte Hysterese empfohlen).
- **Zoom-Level**: Die Winkel-Toleranz sollte in Bildschirm-Pixeln oder als fester Winkelbereich definiert sein, damit das Verhalten zoom-unabhängig bleibt.
- **Kein Bezugspunkt**: Polar Tracking ist inaktiv, solange kein Bezugspunkt existiert.
- **Ortho aktiv**: Polar Tracking wird automatisch deaktiviert.
- **Mehrere mögliche Winkel**: Der nächste gültige Winkel gewinnt.

---

## Anforderungen (Checkliste)

- [ ] Polar Tracking ein-/ausschaltbar (F10 / Statusleisten-Button)
- [ ] Einstellbarer Increment Angle
- [ ] Zusätzliche benutzerdefinierte Winkel
- [ ] Temporäre gestrichelte Tracking-Linie vom Bezugspunkt
- [ ] Tooltip mit Distanz und Winkel
- [ ] Projektion des Klickpunkts auf die Tracking-Linie
- [ ] Unterstützung für Direct Distance Entry
- [ ] Gegenseitiger Ausschluss mit Ortho Mode
- [ ] Integration in den MOVE-Befehl (zweiter Punkt)

---

## Zusammenfassung

Polar Tracking ermöglicht präzises Arbeiten auf geraden Ausrichtungslinien, ohne Object Snaps und ohne den restriktiven Ortho-Modus. Es ist besonders nützlich beim Festlegen des zweiten Punkts im MOVE-Befehl und sollte als eigenständiges, konfigurierbares Feature implementiert werden.
