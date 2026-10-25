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
- **Vorgabe-Radius** wie AutoCAD CIRCLERAD: `Radius für Kreis angeben oder [Durchmesser] <25.0000>:`,
  Enter übernimmt den zuletzt verwendeten Radius bzw. Durchmesser.
- **Methoden-Dropdown** am Button (Mittelpunkt-Radius, Mittelpunkt-Durchmesser, 2P, 3P, TTR, TTT),
  startet den Befehl gleich mit der Option.
- DYN: Beschriftung „Radius“/„Durchmesser“ am Feld.

## ELLIPSE

- **Drehung** (`Abstand zur anderen Achse angeben oder [Drehung]:` → „Drehung um Hauptachse
  angeben:“): Kreis um die erste Achse gedreht, Nebenachse = Hauptachse · cos(Winkel), gültig
  0° bis 89,4°. Braucht eine Winkel-Abfrage (getangle: Zahl in Grad oder Winkel vom Mittelpunkt
  zu einem Punkt) mit DYN-Winkelfeld.
- **Bogen** (`[Bogen/Mittelpunkt]`): elliptischer Bogen, erst die Ellipse wie oben, dann
  „Startwinkel angeben oder [Parameter]:“ und „Endwinkel angeben oder [Parameter/eingeschlossener
  Winkel]:“. Braucht ein Modell für elliptische Bögen (z. B. `startAngle`/`endAngle` als
  Parameter an `EllipseElement` oder ein eigener Typ) samt Renderer, Fang (END, MID), Griffen
  und Serializer, sowie die Winkel-Abfrage.
- Normalisieren wie AutoCAD (immer die längere Achse als Hauptachse speichern): bisher bleibt die
  erste Achse `radiusX`, auch wenn sie die kürzere ist.

## Gemeinsam

- Aktueller Layer und Stil für neue Objekte.
- Werkzeug-Dropdowns in der Werkzeugleiste.

## Noch zu prüfen

- Der Test für „Unbekannter Befehl“ hat bisher kreis verwendet; der ist jetzt bogen.
- Die erste Achse bleibt radiusX, auch wenn sie die kürzere ist. AutoCAD speichert dagegen immer die längere Achse als Hauptachse.
