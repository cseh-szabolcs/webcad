# KREIS und ELLIPSE: noch nicht umgesetzt

Umgesetzt nach `docs/specs/CIRCLE_ELLIPSE_Werkzeug_Spezifikation.md` sind KREIS mit Mittelpunkt +
Radius, Durchmesser, 2P und 3P sowie ELLIPSE mit Achsenendpunkt und Mittelpunkt und dem Abstand
zur anderen Achse (siehe `docs/bedienung.md`). Die Aufforderungen zeigen nur diese Optionen.
Offen, mit dem, was dafür fehlt:

## KREIS

- **Ttr (Tangente, Tangente, Radius)**: zwei Objekte über einen Punkt auf dem Objekt wählen
  („Punkt auf Objekt für erste Tangente des Kreises angeben:“), dann der Radius. Braucht eine
  Abfrage „Punkt auf Objekt“ (Treffer im Fangbereich statt Fangpunkt) und die Berechnung der
  tangentialen Kreise an Linie/Kreis/Bogen (mehrere Lösungen, die den Auswahlpunkten nächste;
  Meldung, wenn keine existiert). Ellipsen und Béziers numerisch.
- **Tan, Tan, Tan** (in AutoCAD nur über das Menü): drei Objekte, Kreis tangential zu allen
  dreien (Apollonius-Problem, für Linien der In-/Ankreis).
- **Tangenten-Fang (TAN)** inkl. „verzögerter Tangente“ bei 2P/3P, und Lot (PER).
- Der Vorgabe-Radius (wie AutoCAD CIRCLERAD) ist umgesetzt; er gilt nur bis zum Neuladen der
  Seite und folgt keiner Einstellung für Einheiten und Genauigkeit (feste Nachkommastellen).
- Im Methoden-Menü am Button fehlen TTR und TTT (die Methoden dazu gibt es noch nicht).
- DYN: Beschriftung „Radius“/„Durchmesser“ am Feld.

## ELLIPSE

- **Drehung** ist umgesetzt. Abweichend von AutoCAD (gültig 0° bis 89,4°) zählt nur der Betrag
  des Cosinus, also auch negative Winkel und solche über 90°; zu prüfen, wie AutoCAD den
  gezeigten Winkel misst und was es bei ungültigen Werten meldet.
- **Bogen** (`[Bogen/Mittelpunkt]`): elliptischer Bogen, erst die Ellipse wie oben, dann
  „Startwinkel angeben oder [Parameter]:“ und „Endwinkel angeben oder [Parameter/eingeschlossener
  Winkel]:“. Braucht ein Modell für elliptische Bögen (z. B. `startAngle`/`endAngle` als
  Parameter an `EllipseElement` oder ein eigener Typ) samt Renderer, Fang (END, MID), Griffen
  und Serializer, sowie die Winkel-Abfrage.
- Normalisieren wie AutoCAD (immer die längere Achse als Hauptachse speichern): bisher bleibt die
  erste Achse `radiusX`, auch wenn sie die kürzere ist.

## Gemeinsam

- Aktueller Layer und Stil für neue Objekte.
- Der Button **Ellipse** zeigt anfangs **Mittelpunkt** (wie in AutoCAD), getippt beginnt ELLIPSE aber mit dem Achsenendpunkt.
- Im Menü der Ellipse fehlt der elliptische Bogen.

## Noch zu prüfen

- Der Test für „Unbekannter Befehl“ hat bisher kreis verwendet, dann bogen; seit es BOGEN gibt, ist er `xyz`.
- Die erste Achse bleibt radiusX, auch wenn sie die kürzere ist. AutoCAD speichert dagegen immer die längere Achse als Hauptachse.
