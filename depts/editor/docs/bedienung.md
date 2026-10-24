# Bedienung des CAD-Editors

Maus- und Tastaturbefehle des Editors (`depts/editor/`). Die Bedienung folgt AutoCAD.
Auf dem Mac entspricht **Option (⌥)** der Taste Alt.

Tastenkürzel wirken, solange der Fokus nicht in einem Textfeld liegt.

Der Editor zeigt Pläne an, wählt Objekte aus und verschiebt sie mit dem Befehl SCHIEBEN
(mit Objektfang, Koordinateneingabe und Rückgängig). Gespeichert wird noch nichts; was
sonst noch fehlt, steht am Ende unter [Noch nicht umgesetzt](#noch-nicht-umgesetzt).

## Oberfläche

- **Toolbar** (oben): Werkzeug **Verschieben** (Befehl SCHIEBEN), Name des Plans, Button
  **Zoom Grenzen** und rechts **Darstellung** mit **Hell / Dunkel / System**.
- **Zeichenfläche** in der Mitte.
- **Kommandozeile** unter der Zeichenfläche: oben in Grau die letzte Meldung (z. B.
  `1 gefunden, 2 gesamt`), darunter die aktuelle Aufforderung (z. B. `Befehl:` oder
  `Basispunkt angeben oder [Verschiebung] <Verschiebung>:`). Bei Punkt-Aufforderungen
  erscheint dahinter ein Textcursor und, was man tippt (siehe
  [Eingabe in der Kommandozeile](#eingabe-in-der-kommandozeile)).
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
2. **`Basispunkt angeben oder [Verschiebung] <Verschiebung>:`** Klick auf einen Punkt,
   mit [Objektfang](#objektfang-ofang), oder Koordinaten eintippen. Die gewählten Objekte
   bleiben hervorgehoben, der Basispunkt wird als kleines Kreuz markiert.
   **Enter** (ohne Eingabe) oder `V` + Enter wählt die Option **Verschiebung**: Die
   Kommandozeile fragt `Verschiebung angeben <0,0>:`, und die Objekte werden um den
   eingetippten Vektor (z. B. `500,-200` oder `1000<30`) oder um die Koordinaten eines
   geklickten Punkts verschoben. Enter ohne Eingabe nimmt `0,0` und verschiebt nichts.
3. **`Zweiten Punkt angeben oder <ersten Punkt als Verschiebung verwenden>:`** Klick auf
   den Zielpunkt, ebenfalls mit Objektfang, oder Eingabe wie unten. Bis dahin folgt eine
   Vorschau der Objekte dem Cursor. Verschoben wird um (Zielpunkt − Basispunkt), der Befehl
   endet. **Enter** ohne Eingabe nimmt den Basispunkt selbst als Verschiebung (Basispunkt
   `100,50` verschiebt um 100 nach rechts und 50 nach oben).

**Esc** bricht den Befehl bei jeder Aufforderung ab (`*Abbruch*`); ist schon etwas
getippt, verwirft das erste Esc nur die Eingabe. Rechtsklick hat bei den
Punkt-Aufforderungen noch keine Funktion. Ohne laufenden Befehl macht **Strg/⌘+Z** bzw.
der Button **Rückgängig** das Verschieben rückgängig, **Strg+Y** / **⌘+⇧+Z** bzw.
**Wiederherstellen** stellt es wieder her.

### Eingabe in der Kommandozeile

Bei den Punkt-Aufforderungen tippt die Tastatur direkt in die Kommandozeile, ohne sie
anzuklicken. **Enter** (oder die **Leertaste**, sobald etwas getippt ist) schließt die
Eingabe ab, **Backspace** löscht das letzte Zeichen, **Esc** verwirft sie. Ein Klick nimmt
den geklickten Punkt und verwirft das Getippte. Dezimaltrennzeichen ist der Punkt, das
Komma trennt die Koordinaten (wie im deutschen AutoCAD). Winkel in Grad, gegen den
Uhrzeigersinn ab der positiven X-Achse; Y zeigt nach oben.

| Eingabe            | Bedeutung                                                              |
|--------------------|------------------------------------------------------------------------|
| `x,y` (auch `#x,y`) | Absoluter Punkt in mm                                                 |
| `@dx,dy`           | Relativ: beim zweiten Punkt zum Basispunkt, beim Basispunkt zum zuletzt angegebenen Punkt (anfangs 0,0) |
| `@abstand<winkel`  | Relativ in Polarkoordinaten, z. B. `@1000<90` = 1 m nach oben          |
| `abstand<winkel`   | Absolut in Polarkoordinaten, vom Ursprung aus                          |
| `@`                | Der Bezugspunkt selbst                                                 |
| Zahl, z. B. `250`  | Nur beim zweiten Punkt: so weit vom Basispunkt in Richtung Cursor (bzw. Fangpunkt); negativ in Gegenrichtung (Direkte Distanzeingabe) |

Bei `Verschiebung angeben <0,0>:` ist die Eingabe immer ein Vektor: `500,0` und `@500,0`
bedeuten dort dasselbe.

Ungültige Eingaben meldet die Kommandozeile mit `Punkt oder Option-Schlüsselwort
erforderlich.`, die Aufforderung bleibt. Getippte Zeichen lösen keine anderen
Tastenkürzel aus; Strg/⌘-Kürzel und F3 wirken weiter.

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

- Rechtsklick bei den Punkt-Aufforderungen (AutoCAD: Kontextmenü bzw. wie Enter).
- **Grip-Funktionen** (Ziehen an Grips) und alle anderen Bearbeitungsbefehle wie Löschen,
  Gruppieren oder Kopieren.
- Gruppenauswahl ausschalten (AutoCAD Ctrl+Shift+A), um einzelne Gruppenmitglieder zu
  wählen.
- Zwischen überlappenden Objekten unter dem Cursor durchschalten.
- Befehle und Optionen beim Objekte-Wählen in der Kommandozeile eintippen (z. B. `V` für
  „Vorherige“); die Verschiebung merkt sich noch nicht die letzte Eingabe als Vorgabe.
- Beim Objektfang: weitere Modi und Spurverfolgung.
- Die Einstellungen im Editor ändern.
