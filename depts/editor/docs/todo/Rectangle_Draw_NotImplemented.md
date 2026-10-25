# RECHTECK: noch nicht umgesetzt

Nach `docs/specs/RECTANG_Werkzeug_Spezifikation.md` ist RECHTECK mit zwei Eckpunkten und der
Option `Abmessungen` (Länge, Breite, dann Quadrant) umgesetzt (siehe `docs/bedienung.md`). Die
Aufforderungen zeigen nur diese Option. Offen ist Folgendes, jeweils mit dem, was dafür fehlt:

## Optionen beim ersten Eckpunkt

Vollständige Aufforderung in AutoCAD: `Ersten Eckpunkt angeben oder
[Fasen/Erhebung/Abrunden/Objekthöhe/Breite]:` (EN `Specify first corner point or
[Chamfer/Elevation/Fillet/Thickness/Width]:`). Die Werte gelten auch für die folgenden Rechtecke,
bis sie geändert werden; AutoCAD nennt sie am Befehlsanfang (z. B. die aktuellen Fasenabstände).

- **Fasen** (`Chamfer`): `Ersten Fasenabstand für Rechtecke angeben <0.0000>:` und den zweiten
  Abstand, dann acht Eckpunkte statt vier (schräge Ecken). Die Geometrie geht mit geraden
  Segmenten. Es fehlt eine Abfrage eines Abstands **ohne** Basispunkt (getdist: Zahl, oder
  zwei Punkte). Die heutige `distance`-Abfrage braucht `from`. Fasen und Abrunden schließen
  sich aus. Passt eine Fase nicht ins Rechteck, zeichnet AutoCAD ohne Fase.
- **Abrunden** (`Fillet`): `Rundungsradius für Rechtecke angeben <0.0000>:`, Ecken als
  Bogensegmente. Braucht Bögen in Polylinien (Vorschlag `bulges` an `PolylineElement`, siehe
  `Polyline_Draw_NotImplemented.md`), dazu dieselbe Abstandsabfrage ohne Basispunkt.
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
- **Drehung** (`Rotation`): `Drehwinkel angeben oder [Punkte auswählen] <0>:` (EN `Specify
  rotation angle or [Pick points] <0>:`), Winkel als Zahl oder vom ersten Eckpunkt zu einem
  Punkt, `Punkte auswählen` mit zwei Punkten. Danach wieder die Eckpunkt-Abfrage,
  die Seiten dann entlang des Winkels (auch für Abmessungen und Quadrant). Der Winkel bleibt
  Vorgabe für folgende Rechtecke. Braucht eine Winkelabfrage (getangle mit DYN-Winkelfeld, wie
  ELLIPSE Drehung).

## Weiteres

- **Vorgabewerte** wie AutoCAD: `Länge der Rechtecke angeben <10.0000>:`, Enter übernimmt den
  zuletzt verwendeten Wert (ebenso Breite, Fläche, Drehung, Fase, Rundung). Sie bleiben über
  Befehle hinweg erhalten, z. B. in einem Speicher wie `DrawingMemory`. Heute meldet Enter
  `Punkt oder Option-Schlüsselwort erforderlich.` bzw. `Erfordert numerischen Abstand oder
  zweiten Punkt.`.
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
