# Spezifikation: Object Snap Tracking (Objektfangverfolgung / AutoTrack)

## Übersicht

**Object Snap Tracking** (auch Objektfangverfolgung oder AutoTrack) ist eine Zeichenhilfe, die temporäre **horizontale und vertikale Ausrichtungspfade** (Alignment Paths) anzeigt.

Sie ermöglicht es, Objekte präzise an bestehenden Geometriepunkten auszurichten, **ohne dass sich die Objekte berühren müssen**. Die Funktion ist besonders nützlich beim Verschieben (MOVE), Kopieren und Zeichnen.

Im Gegensatz zu reinem Object Snapping fängt sie nicht den Cursor an einen Punkt, sondern zeigt Ausrichtungslinien von zuvor „erworbenen“ Snap-Punkten.

---

## Grundprinzip

1. Object Snap Tracking ist aktiv (F11 oder Statusleisten-Button).
2. Mindestens ein Object Snap muss eingeschaltet sein (z. B. Endpoint, Midpoint).
3. Während eines Befehls, der einen Punkt erwartet (z. B. zweiter Punkt beim MOVE):
   - Der Cursor verweilt kurz über einem gültigen Snap-Punkt eines anderen Objekts → der Punkt wird **erworben** (acquired).
   - Ein kleines **+** erscheint am erworbenen Punkt.
   - Beim weiteren Bewegen des Cursors erscheinen gestrichelte Ausrichtungslinien (horizontal/vertikal oder polar) von diesem Punkt.
4. Sobald die Kante oder der Bezugspunkt des bewegten Objekts mit einer solchen Linie übereinstimmt, wird die Ausrichtung visuell angezeigt.
5. Ein Klick platziert den Punkt auf der Tracking-Linie.

---

## Aktivierung und Einstellungen

| Einstellung                  | Beschreibung                                      | Standard |
|-----------------------------|---------------------------------------------------|----------|
| **Object Snap Tracking**    | Ein/Aus (F11)                                     | Aus      |
| **Track Orthogonally Only** | Nur horizontale und vertikale Linien              | An       |
| **Track Using All Polar Angles** | Verwendet auch die Winkel von Polar Tracking | Aus      |
| **Aperture**                | Toleranzbereich zum Erwerben von Punkten          | Mittel   |

- Polar Tracking und Object Snap Tracking können gleichzeitig aktiv sein.
- Object Snaps müssen aktiv sein, damit Punkte erworben werden können.

---

## Visuelle Darstellung

| Element                     | Aussehen                          | Bedeutung |
|-----------------------------|-----------------------------------|-----------|
| **Erworbener Punkt**        | Kleines **+**                     | Punkt wurde für Tracking „gespeichert“ |
| **Tracking-Linie**          | Gestrichelte Linie (meist grün)   | Horizontale oder vertikale Ausrichtung |
| **Tooltip**                 | Textbox                           | Zeigt Distanz und Richtung |
| **Schnittpunkt mehrerer Linien** | Kleines Kreuz oder Marker     | Präziser Schnittpunkt zweier Tracking-Linien |

Die Linien bleiben so lange sichtbar, wie der Cursor in der Nähe der Ausrichtung bleibt.

---

## Ablauf im MOVE-Befehl

```
[Basispunkt gewählt]
        ↓
[Zustand: SecondPoint]
        ↓
[Cursor bewegt sich über andere Objekte]
        ↓
[Gültiger Snap-Punkt wird erkannt → Punkt wird erworben (+)]
        ↓
[Tracking-Linien (horizontal/vertikal) erscheinen]
        ↓
[Kante des bewegten Objekts trifft eine Tracking-Linie]
        ↓
[Visuelle Ausrichtungshilfe wird angezeigt]
        ↓
[User klickt oder gibt Distanz ein]
        ↓
[Zweiter Punkt liegt auf der Tracking-Linie]
        ↓
[Objekte werden verschoben]
```

---

## Technische Umsetzungshinweise

### Datenstrukturen

```text
AcquiredPoint {
  position: Point2D
  snapType: SnapType          // Endpoint, Midpoint, ...
  objectId: ObjectId
  acquiredTime: timestamp
}

TrackingSettings {
  enabled: bool
  orthogonalOnly: bool
  usePolarAngles: bool
  maxAcquiredPoints: int      // z. B. 7
  acquisitionDelay: float     // Millisekunden zum Erwerben
}

TrackingState {
  acquiredPoints: List<AcquiredPoint>
  activeLines: List<TrackingLine>
}
```

### Algorithmus (vereinfacht)

1. **Punkt erwerben**
   - Bei Mausbewegung prüfen, ob der Cursor länger als `acquisitionDelay` über einem gültigen Snap-Punkt verharrt.
   - Falls ja: Punkt zur Liste der erworbenen Punkte hinzufügen (mit Begrenzung der Anzahl).

2. **Tracking-Linien berechnen**
   - Für jeden erworbenen Punkt:
     - Horizontale Linie (gleiche Y-Koordinate)
     - Vertikale Linie (gleiche X-Koordinate)
     - Optional: Polar-Winkel-Linien
   - Prüfen, ob der aktuelle Cursor (oder die Kante des bewegten Objekts) nahe einer dieser Linien liegt.

3. **Darstellung**
   - Aktive Tracking-Linien zeichnen.
   - Tooltip mit Distanz anzeigen.
   - Bei Schnittpunkt mehrerer Linien besonderen Marker setzen.

4. **Punktübernahme**
   - Bei Klick: Wenn eine Tracking-Linie aktiv ist, den projizierten Punkt auf der Linie verwenden.
   - Direct Distance Entry: Distanz entlang der aktiven Tracking-Linie anwenden.

### Integration mit dem bewegten Objekt

Beim MOVE ist es sinnvoll, nicht nur den Cursor, sondern auch die **Bounding-Box-Kanten** oder markante Punkte (Endpoints, Midpoints) des bewegten Objekts gegen die Tracking-Linien zu prüfen. Dadurch erscheinen die Hilfslinien genau dann, wenn sich die Ränder des Objekts mit anderen Objekten in X- oder Y-Richtung ausrichten.

---

## Randfälle & Empfehlungen

- **Zu viele erworbene Punkte**: Alte Punkte automatisch verwerfen (max. 5–7 gleichzeitig).
- **Performance**: Nur Objekte in der Nähe des Cursors prüfen.
- **Hysterese**: Einmal aktive Tracking-Linie nicht sofort wieder deaktivieren bei kleinen Bewegungen.
- **Kombination mit Polar Tracking**: Beide Systeme können parallel laufen; Schnittpunkte beider Linienarten anzeigen.
- **Abbruch**: Bei Esc oder Befehlende alle erworbenen Punkte und Linien löschen.

---

## Anforderungen (Checkliste)

- [ ] Object Snap Tracking ein-/ausschaltbar (F11)
- [ ] Automatisches Erwerben von Snap-Punkten durch Verweilen
- [ ] Darstellung von horizontalen und vertikalen Tracking-Linien
- [ ] Visuelles + am erworbenen Punkt
- [ ] Tooltip mit Distanz
- [ ] Unterstützung für Schnittpunkte mehrerer Tracking-Linien
- [ ] Integration in den MOVE-Befehl (Ausrichtung der Objektkanten)
- [ ] Begrenzung der Anzahl gleichzeitiger erworbener Punkte
- [ ] Optional: Nutzung der Polar-Winkel

---

## Zusammenfassung

Object Snap Tracking ermöglicht präzise Ausrichtung an bestehenden Objekten über temporäre Hilfslinien, ohne dass die Objekte sich berühren. Es ist eine eigenständige Funktion neben Object Snapping und Polar Tracking und sollte als separates Modul implementiert werden.
