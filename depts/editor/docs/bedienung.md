# Bedienung des CAD-Editors

Maus- und Tastaturbefehle des Editors (`depts/editor/`). Die Bedienung folgt AutoCAD.
Auf dem Mac entspricht **Option (⌥)** der Taste Alt.

Tastenkürzel wirken, solange der Fokus nicht in einem Textfeld liegt.

Der Editor zeigt Pläne an, wählt Objekte aus und führt den Befehl SCHIEBEN bis zur Angabe
des zweiten Punkts mit Objektfang. Verschoben wird dabei noch nichts; was sonst noch fehlt,
steht am Ende unter [Noch nicht umgesetzt](#noch-nicht-umgesetzt).

## Oberfläche

- **Toolbar** (oben): Werkzeug **Verschieben** (Befehl SCHIEBEN), Name des Plans, Button
  **Zoom Grenzen** und rechts **Darstellung** mit **Hell / Dunkel / System**.
- **Zeichenfläche** in der Mitte.
- **Kommandozeile** unter der Zeichenfläche, nur zur Anzeige: oben in Grau die letzte
  Meldung (z. B. `1 gefunden, 2 gesamt`), darunter die aktuelle Aufforderung (z. B.
  `Befehl:` oder `Basispunkt angeben:`).
- **Statuszeile** (unten): Cursorposition `X … Y …` in mm, der Objektfang-Schalter
  **OFANG** mit dem Menü **▾** und der Zoom in px/mm.

## Ansicht

| Eingabe                         | Wirkung                                  |
|---------------------------------|------------------------------------------|
| Mausrad / Trackpad scrollen     | Zoomt um den Mauszeiger                  |
| Mittlere Maustaste ziehen       | Verschiebt die Ansicht (Pan)             |
| Leertaste halten + links ziehen | Verschiebt die Ansicht (Pan)             |
| Button **Zoom Grenzen**         | Zeigt den ganzen Plan                    |

Zoomen und Pannen gehen jederzeit, auch während ein Auswahlrechteck offen ist oder ein
Befehl nach einem Punkt fragt.

## Cursor

Über der Zeichenfläche ersetzt ein Fadenkreuz wie in AutoCAD den Mauszeiger. Es zeigt,
was ein Klick gerade tut:

| Situation                                 | Cursor                                   |
|-------------------------------------------|------------------------------------------|
| Kein Befehl aktiv                         | Fadenkreuz mit Pickbox (Quadrat in der Mitte) |
| Befehl fragt `Objekte wählen:`            | Nur die Pickbox                          |
| Befehl fragt nach einem Punkt             | Nur das Fadenkreuz                       |
| Shift gehalten, außer bei Punkt-Aufforderungen (Klick entfernt aus der Auswahl) | Zusätzlich ein Minuszeichen oben rechts |
| Beim Pannen                               | Greifhand                                |

Die **Pickbox** ist genau der Trefferbereich: Ein Objekt wird hervorgehoben und per Klick
gewählt, wenn seine Kontur durch das Quadrat läuft.

## Auswählen

### Überfahren

Beim Überfahren mit der Maus wird hellblau und etwas dicker hervorgehoben, was ein Klick
wählen würde, bei gruppierten Elementen die ganze Gruppe. Bereits gewählte Objekte werden
nicht zusätzlich hervorgehoben.

### Klicken

| Eingabe                 | Wirkung                                             |
|-------------------------|-----------------------------------------------------|
| Klick auf ein Objekt    | Fügt es zur Auswahl hinzu                            |
| Shift + Klick           | Entfernt es aus der Auswahl                         |
| Klick ins Leere         | Bewirkt nichts, die Auswahl bleibt bestehen         |
| Esc (ohne Befehl)       | Hebt die ganze Auswahl auf                          |

Ein erneuter Klick auf ein bereits gewähltes Objekt ändert nichts. Ohne Befehl erscheinen
gewählte Objekte blau mit **Grips** (blaue Quadrate):

| Element                 | Grips                                                       |
|-------------------------|-------------------------------------------------------------|
| Linie                   | Beide Enden und die Mitte                                   |
| Polylinie               | Alle Ecken und die Mitte jedes Segments                     |
| Kreis, Ellipse          | Zentrum und die vier Quadranten                             |
| Bogen                   | Zentrum, Anfang, Ende und Bogenmitte                        |
| Bézier-Kurve            | Beide Enden und die zwei Kontrollpunkte                     |

Die Kontrollpunkte einer Bézier-Kurve liegen neben der Kurve; gestrichelte Linien
(Kontrollrahmen) verbinden sie mit ihrem Endpunkt. Teilen sich gewählte Objekte einen
Punkt, gibt es dort nur einen Grip. Die Grips haben noch keine Funktion.

### Rechteck: Fenster und Kreuzen

1. Ins Leere drücken und mit gedrückter Maustaste ziehen. Das Rechteck erscheint nach
   3 Pixeln Bewegung, die Kommandozeile fragt `Entgegengesetzte Ecke angeben:`.
2. Die Maustaste darf losgelassen werden: Das Rechteck bleibt offen und folgt dem Cursor.
   So lässt sich zoomen oder pannen, wenn der Bereich größer ist als der Bildausschnitt.
3. Abschließen mit einem **Klick** (setzt die zweite Ecke) oder **Enter** (an der
   Cursorposition). Der abschließende Klick wählt kein Objekt, auch wenn er auf einem liegt.

| Richtung              | Art      | Aussehen                 | Gewählt wird                           |
|-----------------------|----------|--------------------------|----------------------------------------|
| Nach rechts gezogen   | Fenster  | Blau, durchgehende Kante | Was vollständig im Rechteck liegt      |
| Nach links gezogen    | Kreuzen  | Grün, gestrichelte Kante | Was das Rechteck berührt oder schneidet |

- Solange das Rechteck offen ist, wird hervorgehoben, was es wählen würde (Vorschau).
- **Shift** beim abschließenden Klick oder **Shift + Enter** entfernt die gefundenen Objekte.
- **Esc** verwirft das Rechteck, die bisherige Auswahl bleibt.

### Lasso

1. **Alt (⌥)** halten, ins Leere drücken und mit gedrückter Maustaste frei ziehen.
2. Loslassen schließt das Lasso ab.

- Nach rechts begonnen wählt es wie ein Fenster, nach links wie Kreuzen.
- Die **Leertaste** wechselt währenddessen zwischen Fenster und Kreuzen.
- Shift beim Loslassen entfernt die gefundenen Objekte, Esc verwirft das Lasso.
- Auch hier wird vorab hervorgehoben, was gewählt würde.

### Was wählbar ist

- Getroffen wird nur die **Kontur**, nie eine Füllung: Ein Klick in die Mitte eines
  gefüllten Tisches wählt ihn nicht.
- Elemente auf **ausgeblendeten oder gesperrten Layern** lassen sich nicht wählen.
- Wird ein Element einer **Gruppe** getroffen (per Klick, Rechteck oder Lasso), wird
  immer die ganze Gruppe gewählt bzw. entfernt. Mitglieder auf gesperrten oder
  ausgeblendeten Layern bleiben außen vor.

## Befehl SCHIEBEN

Button **Verschieben** in der Toolbar. Er bleibt gedrückt, solange der Befehl läuft; ein
weiterer Klick darauf bewirkt dann nichts.

1. **Objekte wählen.** Ist schon etwas gewählt, wird diese Auswahl übernommen
   (`N gefunden`) und es geht direkt zum Basispunkt. Sonst fragt die Kommandozeile
   `SCHIEBEN Objekte wählen:`. Gewählt wird wie oben beschrieben, die Kommandozeile zählt
   mit (z. B. `1 gefunden, 2 gesamt`, `1 gefunden (1 doppelt), 2 gesamt` oder
   `1 gefunden, 1 entfernt, 1 gesamt`). Grips werden dabei nicht gezeigt.
   **Enter** oder **Rechtsklick** beendet die Auswahl; ist nichts gewählt, endet der Befehl.
2. **`Basispunkt angeben:`** Klick auf einen Punkt, mit [Objektfang](#objektfang-ofang).
   Die gewählten Objekte bleiben hervorgehoben, der Basispunkt wird als kleines Kreuz
   markiert.
3. **`Zweiten Punkt angeben oder <ersten Punkt als Verschiebung verwenden>:`** Klick auf
   den Zielpunkt, ebenfalls mit Objektfang. Im Moment zeigt die Kommandozeile danach nur
   die Verschiebung an (`Verschiebung X …, Y … – noch nicht umgesetzt`), der Befehl endet,
   und die Zeichnung bleibt unverändert.

**Esc** bricht den Befehl bei jeder Aufforderung ab (`*Abbruch*`). Enter und Rechtsklick
haben bei den Punkt-Aufforderungen noch keine Funktion.

## Objektfang (OFANG)

Bei den Punkt-Aufforderungen rastet der Cursor auf markante Punkte der Geometrie ein.

| Eingabe                       | Wirkung                                                  |
|-------------------------------|----------------------------------------------------------|
| **F3** oder Button **OFANG**  | Schaltet den Objektfang ein oder aus (beim Start an)     |
| Button **▾** neben OFANG      | Menü, in dem sich die einzelnen Fangmodi an- und abwählen lassen |
| **Tab** / **Shift+Tab**       | Schaltet zum nächsten / vorherigen Fangpunkt im Fangbereich |

Die gewählten Modi bleiben erhalten, wenn der Objektfang ausgeschaltet wird.

| Modus         | Marker   | Fängt                                                          |
|---------------|----------|----------------------------------------------------------------|
| Endpunkt      | Quadrat  | Enden von Linien, Bögen und Bézier-Kurven, Ecken von Polylinien |
| Mittelpunkt   | Dreieck  | Mitte von Linien, Polylinien-Segmenten, Bögen und Bézier-Kurven |
| Zentrum       | Kreis    | Mittelpunkt von Kreisen, Ellipsen und Bögen                    |
| Quadrant      | Raute    | Die vier Außenpunkte von Kreisen und Ellipsen (bei Bögen, soweit sie darauf liegen) |
| Schnittpunkt  | Kreuz    | Schnittpunkte zweier Elemente                                  |

- Gefangen wird, was im **Fangbereich** liegt, einem Quadrat um den Cursor (Standard
  ±10 px, größer als die Pickbox).
- Ein **Zentrum** rastet nur ein, wenn der Mittelpunkt selbst im Fangbereich liegt, und
  erst nachdem der Cursor in dieser Aufforderung einmal über den Kreis, die Ellipse oder
  den Bogen gefahren ist, wie in AutoCAD. Von der Kurve aus wird es nicht angeboten.
- Liegen mehrere Fangpunkte im Bereich, gewinnt der nächste. Sind zwei etwa gleich weit
  entfernt, gilt die Reihenfolge Endpunkt, Schnittpunkt, Zentrum, Mittelpunkt, Quadrant.
  Fallen Punkte zusammen, wird nur einer angezeigt. Der zuletzt gefangene Punkt bleibt
  gefangen, bis ein anderer mehr als 2 px näher liegt, damit der Fang nicht zwischen fast
  gleich nahen Punkten hin- und herspringt.
- Mit **Tab** wird der Reihe nach zu den anderen Fangpunkten im Bereich geschaltet (nach
  dem letzten wieder der erste), mit **Shift+Tab** zurück. Der Tooltip zeigt dann die
  Position, z. B. „Schnittpunkt (Tab 2/3)“, und ein Klick nimmt diesen Punkt. Wird der
  Cursor mehr als 10 px (halbe Breite des Fangbereichs) bewegt, gilt wieder der beste Punkt.
- Angezeigt werden ein **grüner Marker** in der Form des Modus und ein **Tooltip** mit dem
  Namen. Das Fadenkreuz und die Koordinaten in der Statuszeile springen auf den Fangpunkt
  (**Magnet**).
- Elemente auf **ausgeblendeten** Layern werden nicht gefangen, auf **gesperrten** schon.
- Der Fang setzt nur die Position. Elemente werden dadurch nicht miteinander verbunden.

## Darstellung (Hell / Dunkel)

Rechts in der Toolbar unter **Darstellung**:

- **System** (Standard): folgt der Hell-/Dunkel-Einstellung des Betriebssystems, auch
  wenn sie sich während der Arbeit ändert.
- **Hell** bzw. **Dunkel**: feste Wahl, unabhängig vom System.

Der Browser merkt sich die Wahl. Im dunklen Modus werden die Farben des Plans nur für die
Anzeige angepasst: Dunkle Linien erscheinen hell, helle Füllungen als dezente dunkle
Töne. Die gespeicherten Farben im Plan ändern sich nicht.

## Einstellungen

Größen und Schalter für Cursor und Objektfang stehen zentral in
`src/settings/editorSettings.ts` (`DEFAULT_EDITOR_SETTINGS`). Im Editor lassen sie sich
noch nicht ändern; das kommt in einem späteren Schritt.

| Einstellung       | Standard | Bedeutung                                                    | AutoCAD      |
|-------------------|----------|--------------------------------------------------------------|--------------|
| `crosshairSize`   | 5        | Länge der Fadenkreuzlinien in % der größeren Seite der Zeichenfläche; 100 = über die ganze Fläche | CURSORSIZE |
| `pickboxSize`     | 5        | Halbe Kantenlänge der Pickbox in px, zugleich der Trefferbereich | PICKBOX   |
| `showPickbox`     | an       | Pickbox im Fadenkreuz anzeigen                               |              |
| `apertureSize`    | 10       | Halbe Kantenlänge des Fangbereichs in px                      | APERTURE     |
| `showApertureBox` | aus      | Fangbereich bei Punkt-Aufforderungen als Quadrat anzeigen     | APBOX        |
| `snapMarkerSize`  | 5        | Halbe Größe des Fangmarkers in px                             | AUTOSNAPSIZE |
| `snapMarker`      | an       | Fangmarker anzeigen                                           | AUTOSNAP     |
| `snapTooltip`     | an       | Tooltip mit dem Modusnamen anzeigen                           | AUTOSNAP     |
| `snapMagnet`      | an       | Fadenkreuz springt auf den Fangpunkt                          | AUTOSNAP     |

## Noch nicht umgesetzt

- Objekte tatsächlich **verschieben** (Vorschau beim zweiten Punkt, Ausführen,
  Rückgängig), sowie Enter bzw. Rechtsklick bei den Punkt-Aufforderungen (AutoCAD: ersten
  Punkt als Verschiebung verwenden).
- **Grip-Funktionen** (Ziehen an Grips) und alle anderen Bearbeitungsbefehle wie Löschen,
  Gruppieren oder Kopieren.
- **Rückgängig/Wiederholen.**
- Gruppenauswahl ausschalten (AutoCAD Ctrl+Shift+A), um einzelne Gruppenmitglieder zu
  wählen.
- Zwischen überlappenden Objekten unter dem Cursor durchschalten.
- Eingaben in der Kommandozeile (z. B. Koordinaten oder Optionen wie `V` für „Vorherige“).
- Beim Objektfang: weitere Modi und Spurverfolgung.
- Die Einstellungen im Editor ändern.
