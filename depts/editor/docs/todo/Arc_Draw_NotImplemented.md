# BOGEN: noch nicht umgesetzt

Umgesetzt ist BOGEN mit den Methoden **3 Punkte** (Startpunkt, zweiter Punkt, Endpunkt),
**Start, Zentrum, Ende** (Option `Zentrum` beim zweiten Punkt, Strg kehrt die Richtung um),
**Start, Zentrum, Winkel** und **Start, Zentrum, Länge** (Optionen `Winkel` und `sehnenLänge`
beim Endpunkt), allen dreien mit dem Mittelpunkt zuerst (**Zentrum, Start, …**, Option
`Zentrum` beim Startpunkt) und **Start, Ende, Winkel / Richtung / Radius** (Option `Endpunkt`
beim zweiten Punkt, dann der Mittelpunkt oder `Winkel`, `RIchtung`, `RAdius`); siehe `docs/bedienung.md`,
Beschreibung des AutoCAD-Verhaltens in `docs/specs/ARC_Werkzeug_Spezifikation.md` (3 Punkte),
`ARC_Start_Zentrum_Ende_Spezifikation.md` und `ARC_Start_Zentrum_Winkel_Spezifikation.md`.
Die Aufforderungen zeigen nur die Optionen, die es gibt. Offen, mit dem, was dafür fehlt:

## Weitere Methoden

AutoCAD bietet sie im Dropdown des Buttons und als Optionen in den Aufforderungen
(`Startpunkt für Bogen angeben oder [Zentrum]:`, `Zweiten Punkt für Bogen angeben oder
[Zentrum/Endpunkt]:`):

- Bei den Methoden um einen Mittelpunkt Strg **gehalten** statt gedrückt:
  dafür müsste der Editor erfahren, ob Strg gehalten ist (wie `setShiftHeld`), und Strg + Klick
  dürfte auf dem Mac nicht als Rechtsklick ankommen.
- **Weiter** ist umgesetzt (Enter beim Startpunkt oder im Menü). Offen: Nach Rückgängig des
  zuletzt Gezeichneten gibt es nichts zum Fortsetzen, statt des Objekts davor (`DrawingMemory`
  merkt sich nur eines); AutoCAD setzt am letzten Punkt (LASTPOINT) fort.

## Werkzeugleiste

- Eine weitere Methode braucht einen Wert in `ArcMethod` (`src/cad/editor/tools/ArcTool.ts`),
  einen Eintrag in `methods` (`ToolFlyout` in `src/ui/ToolPanel.tsx`) und ein Symbol in
  `ARC_ICON_PATHS` (`src/ui/ToolIcon.tsx`).
- Das Menü hat elf Einträge ohne Trennlinien; AutoCAD gruppiert sie (3 Punkte / Start,
  Zentrum, … / Start, Ende, … / Zentrum, Start, … / Weiter).
- Die Symbole der Methoden „Zentrum zuerst“ unterscheiden sich nur durch den gefüllten
  Mittelpunkt.
- Die zuletzt verwendete Methode merkt sich der Browser, aber nur für Starts über
  den Button, nicht für getippte Optionen. Der Button zeigt gedrückt, sobald BOGEN läuft, auch
  wenn gerade die andere Methode läuft (getippt).

## Sonstiges

- Punkte, die keinen Bogen ergeben, melden einen eigenen Text (`Mit diesem Punkt ergibt sich
  kein Bogen.`); der Wortlaut von AutoCAD ist zu prüfen. ELLIPSE, RECHTECK und LINIE ignorieren
  solche Punkte weiter still.
- Am Endpunkt zeigt die dynamische Eingabe Abstand und Winkel ab dem zweiten Punkt (3 Punkte,
  wie bei KREIS 3P) bzw. ab dem Mittelpunkt (Start, Zentrum, Ende; AutoCAD zeigt dort nur den Winkel).
- Die Methoden um einen Mittelpunkt zeigen den Radius nicht an, sobald Start und Mittelpunkt
  stehen.
- Die Meldungen zu Winkel und Sehnenlänge sind eigene Texte; AutoCAD meldet nur `*Ungültig*`.
  Den Wortlaut der Aufforderungen (`Mittelpunkt für Bogen angeben:`, `Sehnenlänge angeben`,
  `Tangentenrichtung für Startpunkt des Bogens angeben`, `Radius für Bogen angeben`) und die
  Kürzel der Optionen `RIchtung` und `RAdius` bei Gelegenheit gegen ein deutsches AutoCAD
  prüfen, ebenso von wo AutoCAD Winkel, Richtung und Radius beim Zeigen misst (hier: Winkel und
  Richtung ab dem Startpunkt, Radius ab dem Endpunkt).
- Start, Ende, Zentrum (der Mittelpunkt nach `Endpunkt`) gibt es nur über die Option, nicht im
  Menü, wie in AutoCAD.
- Bei Start, Zentrum, Winkel misst das Winkelfeld der dynamischen Eingabe wie die Abfrage ab
  der X-Achse, nicht den Winkel zwischen Start- und Endradius; der Bogen des Felds deckt sich
  also nur dann mit dem gezeichneten Bogen, wenn der Startpunkt rechts vom Mittelpunkt liegt.
- Aktueller Layer und Stil für neue Objekte.
- Der zweite Punkt (3 Punkte) wird nicht gespeichert: der Bogen ist danach Zentrum, Start, Ende
  und Richtung. Bei Start, Zentrum, Ende wird als Ende der Punkt auf dem Kreis gespeichert, nicht
  der angeklickte.
