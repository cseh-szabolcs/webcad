# Grips: noch nicht umgesetzt

Spezifikation: `docs/specs/Grips_Spezifikation.md`. Umgesetzt sind die Zustände warm/hover/hot,
der Modus STRECKEN für alle Elementtypen, der Wechsel mit Leertaste/Enter/Rechtsklick zu
SCHIEBEN, DREHEN, SKALIEREN und SPIEGELN und die Optionen `BAsispunkt`, `Kopieren`, `Zurück`,
`BEzug` und `eXit`, mehrere hot Grips mit Shift + Klick und das Grip-Menü mit `Länge`,
`Radius`, `Scheitelpunkt hinzufügen` und `Scheitelpunkt entfernen` samt Wechsel mit Strg (siehe
`docs/bedienung.md`, Abschnitt „Grips“).
Dazu kommen die Grips als Fangpunkte beim Bearbeiten und die Obergrenze `gripObjectLimit`.
Damit sind alle Schritte der Spezifikation umgesetzt, die das heutige Modell zulässt; offen
sind die Abweichungen und Lücken unten.

## Kleinere Abweichungen von AutoCAD

- Bei der dynamischen Eingabe zeigt das Strecken nur Abstand und Winkel ab dem Grip, nicht die
  objektbezogenen Bemaßungen (neue Länge, Längenänderung, Radius).
- Beim Drehwinkel zeigt die dynamische Eingabe das Winkelfeld allein; mit einem Bezugswinkel
  zeigt es weiter die Richtung zum Punkt (den „neuen Winkel“), nicht die Drehung.
- Grips fangen nur, während ein Grip bearbeitet wird, nicht bei den Punkt-Aufforderungen
  anderer Befehle (dort zeigt die Auswahl keine Grips). Sie werden nicht für die
  Objektfangspuren erfasst und haben keinen eigenen Marker und kein Tab-Durchschalten.
- Über `gripObjectLimit` zeigt die Auswahl gar keine Grips; AutoCAD unterdrückt sie ebenso.
- Mehrere hot Grips: Sind an einem Kreis oder einer Ellipse mehrere Quadranten hot (ohne das
  Zentrum), bestimmt der zuletzt gewählte den Radius; die Vormerkung endet mit jedem
  abgebrochenen Bearbeiten.
- Kopieren geht nur über die Option; AutoCAD startet es auch mit gedrückter Strg-Taste beim
  ersten Zielpunkt und rastet weitere Kopien mit Shift auf den ersten Versatz.
- `Zurück` nimmt Kopien und Basispunkte zurück, aber keinen Bezug und nicht das Einschalten von
  `Kopieren`. Die Vorgaben `<0>` und `<1.0000>` des Bezugs sind fest, AutoCAD merkt sich den
  letzten Wert.
- Die Modi lassen sich nicht per Schlüsselwort anspringen (`ST`, `MO`, `RO`, `SC`, `MI` in
  AutoCAD), nur der Reihe nach.
- Bei der Bezugslänge ohne Punkt (und beim Bezugswinkel) zeigt die dynamische Eingabe keine
  Felder.
- Kopien gruppierter Objekte bilden eine neue Gruppe mit demselben Namen (`CopyCommand`); AutoCAD
  legt dafür eine unbenannte Gruppe an.
- Der Rechtsklick wechselt den Modus (er wirkt überall wie Enter); AutoCAD zeigt dort ein
  Kontextmenü mit den Modi und Optionen.
- Die Undo-Namen: SCHIEBEN per Grip heißt wie der Befehl (`MOVE`); nur seine Kopien heißen
  `GRIP_MOVE`. Angezeigt wird beides gleich.
- Die Abbildungen stehen in `geometry/similarity.ts`, `TransformCommand` und `CopyCommand`
  wenden sie an; beides trägt auch die späteren Befehle DREHEN, VARIA, SPIEGELN und KOPIEREN
  (mit ihrem eigenen Namen als `label`).
- Nach Rückgängig/Wiederherstellen ist die Auswahl leer (wie bei den anderen Befehlen hier).
- Das Grip-Menü erscheint für jeden Grip, der zu genau einem Objekt gehört, auch wenn mehrere
  Objekte gewählt sind (die Spezifikation nennt „nur bei Einzelobjekt“); so haben auch
  gruppierte Objekte eins. Ein von mehreren Objekten geteilter Grip hat keins.
- Im Menü fehlen Tastaturbedienung (Pfeiltasten), die Hervorhebung der gerade aktiven Aktion
  und ein Tooltip am Grip (GRIPTIPS). `Scheitelpunkt entfernen` ist nicht im Strg-Wechsel.
- `Länge` nimmt nur den Punkt (Lotfußpunkt bzw. Winkel); AutoCAD zeigt dazu Gesamtlänge und
  Längenänderung in der dynamischen Eingabe und nimmt sie getippt. Eine getippte Zahl wirkt
  hier als direkte Distanzeingabe ab dem Grip in Richtung Cursor.
- Die Aktionen haben keine Optionen (`Kopieren`, `BAsispunkt` …).
- Ellipsen, Kreise und Béziers haben kein Menü.
- Der Quadrant einer Ellipse ändert nur die Länge seiner Achse, er dreht die Ellipse nicht.

## Nicht umsetzbar mit dem heutigen Modell

- `In Bogen umwandeln` / `In Linie umwandeln` an Polylinien: Polylinien haben keine
  Bogensegmente (Schema-Vorschlag `bulges` in `Polyline_Draw_NotImplemented.md`).
- Grips für Schraffuren, Bemaßungen, Multi-Führungslinien, Splines, Blöcke und Texte: diese
  Elementtypen gibt es noch nicht.
