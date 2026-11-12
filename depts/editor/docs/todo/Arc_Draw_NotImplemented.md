# BOGEN: noch nicht umgesetzt

Umgesetzt ist BOGEN mit den Methoden **3 Punkte** (Startpunkt, zweiter Punkt, Endpunkt),
**Start, Zentrum, Ende** (Option `Zentrum` beim zweiten Punkt, Strg kehrt die Richtung um) und
**Start, Zentrum, Winkel** (Option `Winkel` beim Endpunkt); siehe `docs/bedienung.md`,
Beschreibung des AutoCAD-Verhaltens in `docs/specs/ARC_Werkzeug_Spezifikation.md` (3 Punkte),
`ARC_Start_Zentrum_Ende_Spezifikation.md` und `ARC_Start_Zentrum_Winkel_Spezifikation.md`.
Die Aufforderungen zeigen nur die Optionen, die es gibt. Offen, mit dem, was dafür fehlt:

## Weitere Methoden

AutoCAD bietet sie im Dropdown des Buttons und als Optionen in den Aufforderungen
(`Startpunkt für Bogen angeben oder [Zentrum]:`, `Zweiten Punkt für Bogen angeben oder
[Zentrum/Endpunkt]:`):

- **Zentrum, Start, Ende** / **Zentrum, Start, Winkel** (Option `Zentrum` schon beim
  Startpunkt): wie Start, Zentrum, …, nur zuerst der Mittelpunkt.
- Bei **Start, Zentrum, Ende** und **Start, Zentrum, Winkel** Strg **gehalten** statt gedrückt:
  dafür müsste der Editor erfahren, ob Strg gehalten ist (wie `setShiftHeld`), und Strg + Klick
  dürfte auf dem Mac nicht als Rechtsklick ankommen.
- **Start, Ende, Winkel**: der eingeschlossene Winkel wie bei Start, Zentrum, Winkel
  (`arcByAngle` in `ArcTool.ts` dreht bisher um einen bekannten Mittelpunkt), dazu die Option
  `Endpunkt` beim zweiten Punkt.
- **Start, Zentrum, Länge** / **Zentrum, Start, Länge**: Sehnenlänge (negativ = der große
  Bogen), als Option `Sehnenlänge` am Endpunkt.
- **Start, Ende, Richtung**: Tangentenrichtung am Startpunkt.
- **Start, Ende, Radius**: Radius (negativ = der große Bogen).
- **Weiter** (Enter beim Startpunkt): tangential an die zuletzt gezeichnete Linie, den letzten
  Bogen oder die letzte Polylinie, dann nur noch der Endpunkt. Braucht die Richtung am Ende des
  letzten Objekts (`DrawingMemory` kennt bisher nur dessen Endpunkt, und nur von Linien und
  Polylinien).

## Werkzeugleiste

- Eine weitere Methode braucht einen Wert in `ArcMethod` (`src/cad/editor/tools/ArcTool.ts`),
  einen Eintrag in `methods` (`ToolFlyout` in `src/ui/ToolPanel.tsx`) und ein Symbol in
  `ARC_ICON_PATHS` (`src/ui/ToolIcon.tsx`).
- Die zuletzt verwendete Methode gilt nur bis zum Neuladen der Seite, und nur für Starts über
  den Button, nicht für getippte Optionen. Der Button zeigt gedrückt, sobald BOGEN läuft, auch
  wenn gerade die andere Methode läuft (getippt).

## Sonstiges

- Meldung bei Punkten, die keinen Bogen ergeben: sie werden bisher still ignoriert (wie bei KREIS 3P).
- Am Endpunkt zeigt die dynamische Eingabe Abstand und Winkel ab dem zweiten Punkt (3 Punkte,
  wie bei KREIS 3P) bzw. ab dem Mittelpunkt (Start, Zentrum, Ende; AutoCAD zeigt dort nur den Winkel).
- Start, Zentrum, Ende zeigt nach dem Mittelpunkt den Radius nicht an.
- Die Winkel-Abfrage (`angle`) zeigt kein Feld der dynamischen Eingabe und den aktuellen Winkel
  nicht am Cursor (auch beim Drehen mit Grips nicht, siehe `Grips_NotImplemented.md`).
- LINIE und PLINIE setzen mit Enter nicht an einem gezeichneten Bogen fort (siehe
  `Line_Draw_NotImplemented.md`).
- Aktueller Layer und Stil für neue Objekte.
- Der zweite Punkt (3 Punkte) wird nicht gespeichert: der Bogen ist danach Zentrum, Start, Ende
  und Richtung. Bei Start, Zentrum, Ende wird als Ende der Punkt auf dem Kreis gespeichert, nicht
  der angeklickte.
