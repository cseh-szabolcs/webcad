# RECHTECK: noch nicht umgesetzt

Nach `docs/specs/RECTANG_Werkzeug_Spezifikation.md` ist RECHTECK mit zwei Eckpunkten und der
Option `Abmessungen` (Länge, Breite, dann Quadrant) umgesetzt (siehe `docs/bedienung.md`). Die
Aufforderungen zeigen nur diese Option. Offen ist Folgendes, jeweils mit dem, was dafür fehlt:

## Optionen beim ersten Eckpunkt

Vollständige Aufforderung in AutoCAD: `Ersten Eckpunkt angeben oder
[Fasen/Erhebung/Abrunden/Objekthöhe/Breite]:` (EN `Specify first corner point or
[Chamfer/Elevation/Fillet/Thickness/Width]:`). Die Werte gelten auch für die folgenden Rechtecke,
bis sie geändert werden; AutoCAD nennt sie am Befehlsanfang (z. B. die aktuellen Fasenabstände).

- **Fasen** ist umgesetzt (acht Eckpunkte; passt die Fase nicht, ohne). **Zu prüfen gegen
  AutoCAD:** auf welcher der beiden Seiten einer Ecke der erste und der zweite Abstand liegt
  (hier: der erste auf der ankommenden Seite, reihum ab dem ersten Eckpunkt, also bei ungleichen
  Abständen wie ein Windrad) und wann genau AutoCAD die Fase weglässt. Fasen und Abrunden
  schließen sich später aus.
- **Abrunden** (`Fillet`): `Rundungsradius für Rechtecke angeben <0.0000>:`, Ecken als
  Bogensegmente. Braucht Bögen in Polylinien (Vorschlag `bulges` an `PolylineElement`, siehe
  `Polyline_Draw_NotImplemented.md`); die Abstandsabfrage ohne Basispunkt gibt es (wie bei Fasen).
- **Breite** (`Width`): Polylinienbreite. Braucht Breite/Halbbreite im Polylinienmodell und im
  Renderer (wie PLINIE Breite).
- **Erhebung** und **Objekthöhe** (`Elevation`, `Thickness`): Z-Höhe und Extrusion. Das Modell
  ist rein 2D, also bis auf Weiteres nicht sinnvoll.
- Vorschau mit Fase, Rundung und Breite (Spezifikation Abschnitt 5).

## Optionen beim anderen Eckpunkt

Vollständig: `Anderen Eckpunkt angeben oder [Fläche/Abmessungen/Drehung]:`.

- **Fläche** (`Area`): `Fläche des Rechtecks in aktuellen Einheiten eingeben <100.0000>:`, dann
  `Rechteckmaße basierend auf [Länge/Breite] berechnen <Länge>:` und die Länge bzw. Breite; die
  andere Seite wird berechnet (mit Fase/Rundung einschließlich deren Flächenverlust). Braucht
  eine reine Zahlenabfrage (getreal, ohne Punkt) und eine reine Schlüsselwortabfrage. Zu prüfen
  ist, ob AutoCAD danach sofort zeichnet (ab dem ersten Eckpunkt in +X/+Y, gedreht) oder wie die
  Spezifikation einen Quadranten wählen lässt.
- **Drehung** ist umgesetzt (Winkel als Zahl oder vom ersten Eckpunkt zu einem Punkt, bleibt
  für die folgenden Rechtecke). Offen: die Option `Punkte auswählen` (`Drehwinkel angeben oder
  [Punkte auswählen] <0>:`, EN `Pick points`) mit zwei frei gewählten Punkten.
- Die Rechteckmodi (Drehung, Fasen) gelten nur bis zum Neuladen der Seite.

## Weiteres

- **Vorgabewerte**: für Länge und Breite umgesetzt (`DrawingMemory`, Enter übernimmt den
  zuletzt angegebenen Wert). AutoCAD beginnt mit `<10.0000>`, hier gibt es vor der ersten
  Angabe keine Vorgabe. Offen für Fläche, Drehung, Fase und Rundung, sobald es die Optionen
  gibt.
- **DYN beim anderen Eckpunkt**: AutoCAD zeigt dort zwei Bemaßungen an den Seiten (Länge und
  Breite, Tab wechselt). Bisher gilt die Bemaßung von `next` (Abstand/Winkel der Diagonale,
  `,` wechselt zu X/Y).
- Fangen und Spuren an der eigenen Vorschau gibt es nicht (wie bei PLINIE).
- Aktueller Layer und Stil für neue Objekte.

## Noch zu prüfen

- Bestätigt sind die Schlüsselwörter (Fasen, Erhebung, Abrunden, Objekthöhe, Breite, Fläche,
  Abmessungen, Drehung, Punkte auswählen), die Begriffe Fasenabstand, Rundungsradius und
  Drehwinkel, die Drehwinkel-Aufforderung und „Länge/Breite der Rechtecke angeben“. Den
  genauen Wortlaut der übrigen Aufforderungen (Fasenabstand, Rundungsradius, die beiden der
  Fläche) beim Umsetzen gegen ein deutsches AutoCAD prüfen.
