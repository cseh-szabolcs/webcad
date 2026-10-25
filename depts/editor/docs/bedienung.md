# Bedienung des CAD-Editors

Maus- und Tastaturbefehle des Editors (`depts/editor/`). Die Bedienung folgt AutoCAD.
Auf dem Mac entspricht **Option (⌥)** der Taste Alt.

Tastenkürzel wirken, solange der Fokus nicht in einem Textfeld liegt.

Der Editor zeigt Pläne an, wählt Objekte aus und verschiebt sie mit dem Befehl SCHIEBEN
(mit Raster, Objektfang, Polarspur, Ortho, Objektfangspuren, Koordinateneingabe und Rückgängig). Gespeichert wird noch nichts; was
sonst noch fehlt, steht am Ende unter [Noch nicht umgesetzt](#noch-nicht-umgesetzt).

## Oberfläche

- **Toolbar** (oben): Werkzeug **Verschieben** (Befehl SCHIEBEN), Name des Plans, Button
  **Zoom Grenzen**, rechts die Auswahlen **Darstellung** (Hell / Dunkel / System, mit
  Sonne, Mond bzw. Bildschirm als Symbol) und **Sprache** (DE / EN). Sie sehen aus wie
  die Schalter der Statusleiste: Ein Klick auf den angezeigten Wert oder auf **▾** öffnet
  ein Menü nach unten; die Wahl dort schließt es, ebenso **Esc** oder ein Klick daneben.
  Ganz rechts der Button **Vollbild** (Symbol mit vier Ecken): zeigt den Editor im
  Vollbild des Browsers. Im Vollbild wechselt er zu **Vollbild beenden** (Ecken nach
  innen); verlassen lässt es sich auch mit **Esc** oder über den Browser. Kann die Seite
  nicht ins Vollbild (z. B. in einem iframe ohne Erlaubnis), fehlt der Button.
- **Zeichenfläche** in der Mitte, mit dem [BKS-Symbol](#bks-symbol) am Nullpunkt bzw.
  unten links.
- **Kommandozeile** unter der Zeichenfläche: oben in Grau die letzte Meldung (z. B.
  `1 gefunden, 2 gesamt`), darunter die aktuelle Aufforderung (z. B. `Befehl:` oder
  `Basispunkt angeben oder [Verschiebung] <Verschiebung>:`). Bei Punkt-Aufforderungen
  erscheint dahinter ein Textcursor und, was man tippt (siehe
  [Eingabe in der Kommandozeile](#eingabe-in-der-kommandozeile)).
- **Statuszeile** (unten): links der Raster-Schalter **RASTER**, der Schalter **ORTHO**, der
  Polarspur-Schalter **POLAR**, der Objektfang-Schalter **OFANG** und der Schalter
  **OTRACK** für die Objektfangspuren; alle außer ORTHO mit dem Menü **▾**; rechts die Cursorposition
  `X … Y …` in mm und der Zoom in px/mm.

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
   wenigen Pixeln Bewegung (`DRAG_THRESHOLD_PX` in `src/cad/editor/SelectionEditor.ts`),
   die Kommandozeile fragt `Entgegengesetzte Ecke angeben:`.
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

Oder bei `Befehl:` den Namen tippen, `SCHIEBEN` oder `MOVE` (Groß-/Kleinschreibung egal,
in jeder Sprache), und mit **Enter** oder **Leertaste** ausführen. Der Text erscheint in
der Kommandozeile; **Rücktaste** korrigiert, **Esc** verwirft ihn (erst ein zweites **Esc**
hebt die Auswahl auf). Ohne getippten Text behalten Leertaste (Verschieben der Ansicht),
Enter und Esc ihre übliche Bedeutung. Ein unbekannter Name meldet
`Unbekannter Befehl "XYZ".`. Während ein Auswahlrechteck oder Lasso offen ist, wird nicht
getippt.

1. **Objekte wählen.** Ist schon etwas gewählt, wird diese Auswahl übernommen
   (`N gefunden`) und es geht direkt zum Basispunkt. Sonst fragt die Kommandozeile
   `SCHIEBEN Objekte wählen:`. Gewählt wird wie oben beschrieben, die Kommandozeile zählt
   mit (z. B. `1 gefunden, 2 gesamt`, `1 gefunden (1 doppelt), 2 gesamt` oder
   `1 gefunden, 1 entfernt, 1 gesamt`). Grips werden dabei nicht gezeigt.
   **Enter** oder **Rechtsklick** beendet die Auswahl; ist nichts gewählt, endet der Befehl.
2. **`Basispunkt angeben oder [Verschiebung] <Verschiebung>:`** Klick auf einen Punkt,
   mit [Objektfang](#objektfang-ofang) und [Objektfangspuren](#objektfangspuren-otrack), oder Koordinaten eintippen. Die gewählten Objekte
   bleiben hervorgehoben, der Basispunkt wird als kleines Kreuz markiert.
   **Enter** (ohne Eingabe) oder `V` + Enter wählt die Option **Verschiebung**: Die
   Kommandozeile fragt `Verschiebung angeben <0,0>:`, und die Objekte werden um den
   eingetippten Vektor (z. B. `500,-200` oder `1000<30`) oder um die Koordinaten eines
   geklickten Punkts verschoben. Enter ohne Eingabe nimmt `0,0` und verschiebt nichts.
3. **`Zweiten Punkt angeben oder <ersten Punkt als Verschiebung verwenden>:`** Klick auf
   den Zielpunkt, ebenfalls mit Objektfang, [Polarspur](#polarspur-polar) und
   Objektfangspuren, oder Eingabe
   wie unten. Bis dahin folgt eine
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
| Zahl, z. B. `250`  | Nur beim zweiten Punkt: so weit vom Basispunkt in Richtung Cursor (bzw. Fangpunkt oder entlang der Polarspur); negativ in Gegenrichtung (Direkte Distanzeingabe) |

Bei `Verschiebung angeben <0,0>:` ist die Eingabe immer ein Vektor: `500,0` und `@500,0`
bedeuten dort dasselbe.

Ungültige Eingaben meldet die Kommandozeile mit `Punkt oder Option-Schlüsselwort
erforderlich.`, die Aufforderung bleibt. Getippte Zeichen lösen keine anderen
Tastenkürzel aus; Strg/⌘-Kürzel, F3, F7, F8, F10 und F11 wirken weiter.

## Objektfang (OFANG)

Bei den Punkt-Aufforderungen rastet der Cursor auf markante Punkte der Geometrie ein.

| Eingabe                       | Wirkung                                                  |
|-------------------------------|----------------------------------------------------------|
| **F3** oder Button **OFANG**  | Schaltet den Objektfang ein oder aus                     |
| Button **▾** neben OFANG      | Menü, in dem sich die einzelnen Fangmodi an- und abwählen lassen |
| **Tab** / **Shift+Tab**       | Schaltet zum nächsten / vorherigen Fangpunkt im Fangbereich |

Die gewählten Modi bleiben erhalten, wenn der Objektfang ausgeschaltet wird.

| Modus         | Marker   | Fängt                                                          |
|---------------|----------|----------------------------------------------------------------|
| Endpunkt      | Quadrat  | Enden von Linien, Bögen und Bézier-Kurven, Ecken von Polylinien |
| Mittelpunkt   | Dreieck  | Mitte von Linien, Polylinien-Segmenten, Bögen und Bézier-Kurven |
| Zentrum       | Kreis    | Mittelpunkt von Kreisen, Ellipsen und Bögen                    |
| Geometrisches Zentrum | Kreis mit Punkt | Flächenschwerpunkt geschlossener Polylinien |
| Quadrant      | Raute    | Die vier Außenpunkte von Kreisen und Ellipsen (bei Bögen, soweit sie darauf liegen) |
| Schnittpunkt  | Kreuz    | Schnittpunkte zweier Elemente                                  |

- Gefangen wird, was im **Fangbereich** liegt, einem Quadrat um den Cursor (Größe:
  Einstellung `apertureSize`).
- Ein **Zentrum** rastet nur ein, wenn der Mittelpunkt selbst im Fangbereich liegt, und
  erst nachdem der Cursor in dieser Aufforderung einmal über den Kreis, die Ellipse oder
  den Bogen gefahren ist, wie in AutoCAD. Von der Kurve aus wird es nicht angeboten.
- Das **geometrische Zentrum** ist der Flächenschwerpunkt einer geschlossenen Polylinie mit
  mindestens drei Ecken (nicht der Mittelwert der Ecken; beim Sofa die Mitte des
  Rechtecks). Hat die Polylinie keine Fläche (alle Ecken auf einer Geraden), gilt die Mitte
  ihres umgebenden Rechtecks. Es rastet wie das Zentrum nur ein, wenn es selbst im
  Fangbereich liegt und der Cursor in dieser Aufforderung schon über die Polylinie gefahren
  ist. Ein- und ausgeschaltet wird der Modus wie die anderen im Menü **▾**.
- Liegen mehrere Fangpunkte im Bereich, gewinnt der nächste. Sind zwei etwa gleich weit
  entfernt, gilt die Reihenfolge Endpunkt, Schnittpunkt, Zentrum, Mittelpunkt, Quadrant,
  geometrisches Zentrum.
  Fallen Punkte zusammen, wird nur einer angezeigt. Der zuletzt gefangene Punkt bleibt
  gefangen, bis ein anderer um mehr als ein paar Pixel näher liegt, damit der Fang nicht
  zwischen fast gleich nahen Punkten hin- und herspringt. „Etwa gleich weit“ und „ein paar
  Pixel“ sind dieselbe Grenze: `TIE_TOLERANCE_PX` in
  `src/cad/editor/snapping/SnapEngine.ts`.
- Mit **Tab** wird der Reihe nach zu den anderen Fangpunkten im Bereich geschaltet (nach
  dem letzten wieder der erste), mit **Shift+Tab** zurück. Der Tooltip zeigt dann die
  Position, z. B. „Schnittpunkt (Tab 2/3)“, und ein Klick nimmt diesen Punkt. Wird der
  Cursor weiter als die halbe Breite des Fangbereichs bewegt, gilt wieder der beste Punkt.
- Angezeigt werden ein **grüner Marker** in der Form des Modus und ein **Tooltip** mit dem
  Namen. Das Fadenkreuz und die Koordinaten in der Statuszeile springen auf den Fangpunkt
  (**Magnet**).
- **Fangpunkt-Vorschau** (bewusst anders als AutoCAD): Liegt bei einer Punkt-Aufforderung
  die Kontur eines Objekts im Fangbereich, zeigen kleine Marker in der Form des Modus alle
  Fangpunkte dieses Objekts in den eingeschalteten Modi, auch weit vom Cursor entfernt:
  Endpunkte, Mittelpunkte, Zentrum, geometrisches Zentrum, Quadranten und die
  Schnittpunkte mit anderen Objekten.
  Liegt keine Kontur im Fangbereich, gilt das innerste geschlossene Objekt (Kreis, Ellipse,
  geschlossene Polylinie) um den Cursor, über dessen Linie der Cursor in dieser Aufforderung
  gefahren ist: Wer über die Tischkante in den Tisch fährt, sieht dort den Tisch, daneben
  auf dem Teppich den Teppich, sonst im Raum die Innenwand. Beginnt die Aufforderung mitten
  in einem Objekt, erscheint dessen Vorschau erst, wenn der Cursor seine Linie berührt hat.
  Sie haben dieselbe Farbe wie das Gummiband (Einstellung `previewColor`) und keine
  Funktion; sie zeigen nur, wo gefangen werden kann. Ein Klick nimmt weiterhin den normalen
  Fangpunkt oder die Cursorposition. Kommt der Cursor in die Nähe eines dieser Punkte, gilt
  der normale Fang (grüner Marker, Tooltip, Magnet, Tab); an diesem Punkt entfällt dann der
  Vorschau-Marker. Bei ausgeschaltetem Objektfang (F3) gibt es keine Vorschau, ausschalten
  lässt sie sich mit der Einstellung `snapPreview`.
- Elemente auf **ausgeblendeten** Layern werden nicht gefangen, auf **gesperrten** schon.
- Der Fang setzt nur die Position. Elemente werden dadurch nicht miteinander verbunden.

## Polarspur (POLAR)

Beim zweiten Punkt von SCHIEBEN zeigt die Polarspur, wenn der Cursor nahe an einer
Richtung unter einem Polarwinkel ab dem Basispunkt liegt (bei einem Winkelschritt von 90°
also waagrecht und senkrecht). Der Punkt liegt dann exakt auf dieser Geraden.

| Eingabe                       | Wirkung                                                  |
|-------------------------------|----------------------------------------------------------|
| **F10** oder Button **POLAR** | Schaltet die Polarspur ein oder aus                      |
| Button **▾** neben POLAR      | Menü mit den Winkelschritten zur Auswahl; die Wahl schaltet die Polarspur ein |
| Feld **Zusatzwinkel** im Menü | Weitere Winkel zusätzlich zu den Vielfachen des Schritts, z. B. `30, 60` |

- Der **Winkelschritt** gilt mit allen Vielfachen (45° ergibt 0°, 45°, 90°, …), daher ist
  immer genau einer gewählt. Einzelne weitere Richtungen kommen ins Feld **Zusatzwinkel**:
  Winkel in Grad, getrennt durch Komma, Semikolon oder Leerzeichen, Dezimalpunkt (z. B.
  `30, 60` oder `22.5`), ein `°` dahinter ist erlaubt, höchstens so viele Winkel wie
  `MAX_ADDITIONAL_ANGLES` in `src/cad/editor/tracking/PolarTracking.ts`. Jede gültige
  Eingabe gilt sofort und schaltet die Polarspur ein; eine ungültige wird rot umrandet,
  dann bleiben die zuletzt gültigen Winkel. Ein leeres Feld entfernt die Zusatzwinkel.
- Die Spur greift, wenn der Cursor nah genug an ihr liegt (Abstand in px, unabhängig vom
  Zoom: Einstellung `polarTolerance`) und mindestens so weit vom Basispunkt. Bei mehreren Winkeln gewinnt der
  nächste; die zuletzt gezeigte Spur bleibt, bis eine andere um mehr als ein paar Pixel
  näher liegt (`HYSTERESIS_PX` in `src/cad/editor/tracking/PolarTracking.ts`).
- Angezeigt werden eine **grüne gestrichelte Linie** vom Basispunkt bis zum Rand der
  Zeichenfläche, ein kleines **x** am Punkt auf der Spur und ein **Tooltip** mit Abstand
  und Winkel, z. B. `Polar: 1000.00 < 90°`. Fadenkreuz und Statuszeile springen auf die
  Spur (wie beim Magnet des Objektfangs). Vorschau und Gummiband folgen dem Punkt; das Gummiband
  liegt über der Spurlinie.
- **Klick** nimmt den Punkt auf der Spur. Eine getippte **Zahl** + Enter geht diesen
  Abstand entlang der Spur, ohne dass der Winkel eingegeben werden muss.
- Ein **Fangpunkt** hat Vorrang: Liegt einer im Fangbereich, gilt er und die Spur
  verschwindet. Getippte Koordinaten haben ebenfalls Vorrang.
- Die Polarspur wirkt auch bei ausgeschaltetem Objektfang. Beim Basispunkt gibt es keine
  Spur, weil noch kein Bezugspunkt existiert.

## Ortho (ORTHO)

Beim zweiten Punkt von SCHIEBEN liegt der Punkt mit Ortho immer auf der Waagrechten oder
der Senkrechten durch den Basispunkt, je nachdem, welche dem Cursor näher liegt. Anders
als bei der Polarspur gilt das ohne Toleranz, egal wie weit der Cursor daneben liegt.

| Eingabe                       | Wirkung                                                  |
|-------------------------------|----------------------------------------------------------|
| **F8** oder Button **ORTHO**  | Schaltet Ortho ein oder aus                              |

- Ortho und Polarspur schließen sich aus: Ortho ein schaltet POLAR aus, POLAR ein (auch
  über die Winkelwahl im Menü) schaltet Ortho aus. Die Polarwinkel bleiben erhalten.
- Es gibt keine eigene Spurlinie und keinen Tooltip, wie in AutoCAD: Vorschau und Gummiband
  folgen dem Ortho-Punkt, das Fadenkreuz bleibt am Mauszeiger.
- **Klick** nimmt den Ortho-Punkt. Eine getippte **Zahl** + Enter geht diesen Abstand
  waagrecht bzw. senkrecht.
- Ein **Fangpunkt** und getippte Koordinaten haben Vorrang. Beim Basispunkt wirkt Ortho
  nicht, weil noch kein Bezugspunkt existiert.

## Objektfangspuren (OTRACK)

Mit den Objektfangspuren lässt sich ein Punkt an bestehenden Fangpunkten ausrichten, ohne
dass er sie berührt, z. B. waagrecht neben einer Ecke oder genau dort, wo die Senkrechte
durch die eine und die Waagrechte durch eine andere Ecke sich kreuzen.

| Eingabe                        | Wirkung                                                  |
|--------------------------------|----------------------------------------------------------|
| **F11** oder Button **OTRACK** | Schaltet die Objektfangspuren ein oder aus               |
| Button **▾** neben OTRACK      | Menü: **Nur orthogonal spuren** oder **Mit allen Polarwinkeln spuren**; die Wahl schaltet OTRACK ein |
| Cursor auf einem Fangpunkt ruhen lassen | Erfasst den Punkt (kleines **+**); auf einem erfassten Punkt entfernt es ihn wieder |

- Sie wirken bei **allen Punkt-Aufforderungen** von SCHIEBEN (Basispunkt, zweiter Punkt,
  Verschiebung), auch ohne Basispunkt.
- **Erfassen:** Bleibt derselbe Fangpunkt eine kurze Zeit lang der Fangpunkt unter dem
  Cursor (Einstellung `trackingAcquireDelay`), wird er erfasst und mit einem kleinen grünen
  **+** markiert. Kurzes Überfahren erfasst nichts. Erneutes Verweilen auf einem erfassten
  Punkt entfernt ihn. Es gibt höchstens so viele erfasste Punkte wie `MAX_ACQUIRED_POINTS`
  in `src/cad/editor/tracking/ObjectSnapTracking.ts`; ein weiterer verdrängt den ältesten.
  Der Punkt, auf dem der Cursor beim Beginn einer Aufforderung steht (etwa der eben
  geklickte Basispunkt), wird erst erfasst, wenn der Cursor ihn verlassen hat und
  zurückkommt.
- Erfasst werden nur Fangpunkte der eingeschalteten Modi; mit ausgeschaltetem **OFANG**
  (F3) gibt es weder Erfassen noch Spuren.
- **Spuren:** Von jedem erfassten Punkt laufen Spuren waagrecht und senkrecht, mit **Mit
  allen Polarwinkeln spuren** unter allen Winkeln der [Polarspur](#polarspur-polar)
  (Winkelschritt und Zusatzwinkel, auch wenn POLAR aus ist). Liegt der Cursor nahe einer
  Spur (Einstellung `polarTolerance`, wie bei der Polarspur), liegt der Punkt genau auf
  ihr; die nächste Spur gewinnt, die zuletzt gezeigte bleibt, bis eine andere um mehr als
  ein paar Pixel näher liegt (`HYSTERESIS_PX` in `src/cad/editor/tracking/PolarTracking.ts`).
- **Schnittpunkte:** Kreuzen sich zwei Spuren verschiedener erfasster Punkte im
  Fangbereich (Einstellung `apertureSize`), rastet der Punkt auf den Schnittpunkt. Beim
  zweiten Punkt zählen auch die Polarspuren vom Basispunkt (POLAR ein) bzw. mit ORTHO die
  Waagrechte oder Senkrechte durch den Basispunkt, auf der der Ortho-Punkt liegt. Mit ORTHO
  rastet der Punkt nur auf solche Schnittpunkte und bleibt sonst auf der Ortho-Richtung.
- Angezeigt werden die **grünen gestrichelten Spuren** vom erfassten Punkt (bzw. vom
  Basispunkt) durch den Punkt bis zum Rand der Zeichenfläche, ein kleines **x** am Punkt und
  ein **Tooltip**: auf einer Spur Modus, Abstand und Winkel, z. B. `Endpunkt: 250.00 < 0°`;
  an einem Schnittpunkt Modus und Winkel beider Spuren, z. B. `Endpunkt: < 270°, Polar: <
  180°` (die Ortho-Richtung ohne Linie und Text). Fadenkreuz und Statuszeile springen auf
  den Punkt.
- **Klick** nimmt den Punkt. Eine getippte **Zahl** + Enter auf einer einzelnen Spur geht
  diesen Abstand **vom erfassten Punkt** entlang der Spur (auch beim Basispunkt); an einem
  Schnittpunkt gilt die Zahl wie sonst vom Basispunkt aus.
- **Vorrang:** Ein Fangpunkt im Fangbereich gewinnt, dann ein Schnittpunkt von Spuren, dann
  die nähere von Objektfangspur und Polarspur, dann Ortho. Getippte Koordinaten haben
  ebenfalls Vorrang.
- Die erfassten Punkte gelten für eine Punkt-Aufforderung: Ein gegebener Punkt, **Esc**, das
  Ende des Befehls und das Ausschalten von OTRACK verwerfen sie.

## Raster (RASTER)

Ein Linienraster unter der Zeichnung hilft, Abstände und Lage abzuschätzen, wie
Millimeterpapier. Es ist nur Anzeige: Es gehört nicht zum Plan, wird nie gedruckt und
beeinflusst weder Auswahl noch Objektfang noch Zoom Grenzen. Die Linien laufen parallel zu
X und Y durch den Nullpunkt; regelmäßig ist eine davon eine kräftigere Hauptlinie.

| Eingabe                       | Wirkung                                                  |
|-------------------------------|----------------------------------------------------------|
| **F7** oder Button **RASTER** | Schaltet das Raster ein oder aus                         |
| **▾** neben RASTER            | Menü mit **Rasterabstand (mm)** und **Hauptlinie alle**  |

- **Rasterabstand**: Abstand der Linien in mm, größer als 0, Dezimalpunkt.
- **Hauptlinie alle**: jede wievielte Linie eine Hauptlinie ist, ganze Zahl ab 1 bis
  `MAX_MAJOR_EVERY` in `src/cad/renderer/grid.ts`.
- Jede gültige Eingabe gilt sofort und schaltet das Raster ein. Eine ungültige wird rot
  markiert, bis dahin bleibt der letzte gültige Wert.
- **Beim Herauszoomen wird das Raster gröber**, wie AutoCAD: Lägen die Linien enger als
  der kleinste Linienabstand in px (Einstellung `gridMinSpacing`), wird der Abstand mit
  „Hauptlinie alle“ multipliziert (bei 1 verdoppelt), bis es passt. Bei 10 mm Abstand und
  Hauptlinie alle 10 zeigt das Raster also 10 mm, 100 mm, 1 m oder 10 m; die
  Hauptlinien der einen Stufe sind die Nebenlinien der nächsten. Feiner als der
  eingestellte Abstand wird es nie.

## BKS-Symbol

Das BKS-Symbol (AutoCAD: UCS-Icon, 2D-Stil) zeigt die Lage des Koordinatensystems: die
X-Achse nach rechts, die Y-Achse nach oben, beschriftet mit **X** und **Y**. Das kleine
Quadrat am Ursprung bedeutet, dass das Weltkoordinatensystem (WKS) gilt; ein eigenes BKS
gibt es noch nicht, das Quadrat ist also immer da.

- Das Symbol sitzt **am Nullpunkt (0,0)** der Zeichnung und wandert beim Zoomen und Pannen
  mit, solange es dort ganz und mit etwas Abstand zum Rand in die Zeichenfläche passt
  (`UCS_ICON_MARGIN_PX` in `src/cad/renderer/ucsIcon.ts`).
- Sonst (Nullpunkt außerhalb oder zu nah am Rand) sitzt es **unten links** in der
  Zeichenfläche.
- Es ist nur Anzeige: Es gehört nicht zum Plan, wird nie gedruckt, lässt sich nicht wählen
  und ist für Klicks durchlässig. Fadenkreuz und Fangmarker liegen darüber.
- Ein-/Ausblenden, „immer unten links“, die Größe, die Schriftgröße der Beschriftung und
  die Deckkraft stehen vorerst nur in den [Einstellungen](#einstellungen) (`ucsIcon`,
  `ucsIconAtOrigin`, `ucsIconSize`, `ucsIconLabelSize`, `ucsIconOpacity`).

## Darstellung (Hell / Dunkel)

Rechts in der Toolbar in der Auswahl **Darstellung**:

- **System** (Standard): folgt der Hell-/Dunkel-Einstellung des Betriebssystems, auch
  wenn sie sich während der Arbeit ändert.
- **Hell** bzw. **Dunkel**: feste Wahl, unabhängig vom System.

Der Browser merkt sich die Wahl. Im dunklen Modus werden die Farben des Plans nur für die
Anzeige angepasst: Dunkle Linien erscheinen hell, helle Füllungen als dezente dunkle
Töne. Die gespeicherten Farben im Plan ändern sich nicht.

## Sprache (Deutsch / Englisch)

Rechts in der Toolbar in der Auswahl **Sprache**: **Deutsch** oder **English** (angezeigt als
**DE** bzw. **EN**). Ohne gemerkte Wahl gilt die
Sprache des Browsers (Deutsch für jede deutsche Einstellung, sonst Englisch). Der Browser
merkt sich die Wahl. Die Umschaltung wirkt sofort, auch mitten in einem Befehl: Toolbar,
Statusleiste (RASTER/GRID, OFANG/OSNAP …), Fang-Tooltips und Kommandozeile wechseln. Die
Kommandozeile folgt dem englischen AutoCAD (`Command:`, `MOVE`, `Specify base point or
[Displacement] <Displacement>:`, `1 found, 2 total`, `*Cancel*`); die Option heißt dann
**Displacement**, also `D` statt `V`. Befehlsnamen gelten in beiden Sprachen (`SCHIEBEN`
und `MOVE`); angezeigt wird der Name der eingestellten Sprache. Die Namen im Plan selbst
werden nicht übersetzt.

## Einstellungen

Alle Einstellungen und ihre Standardwerte stehen zentral in
`src/settings/editorSettings.ts`; dort sind sie auch kommentiert. Diese Anleitung nennt
bewusst keine Werte, damit sie nicht doppelt gepflegt werden müssen. Im Editor lassen sich
die Einstellungen noch nicht ändern; das kommt in einem späteren Schritt.

`DEFAULT_EDITOR_SETTINGS` – Größen, Schalter und Farben für Cursor, Objektfang, Raster
und BKS-Symbol, gelesen beim Laden eines Plans:

| Einstellung        | Bedeutung                                                     | AutoCAD      |
|--------------------|---------------------------------------------------------------|--------------|
| `crosshairSize`    | Länge der Fadenkreuzlinien in % der größeren Seite der Zeichenfläche; 100 = über die ganze Fläche | CURSORSIZE |
| `pickboxSize`      | Halbe Kantenlänge der Pickbox in px, zugleich der Trefferbereich | PICKBOX   |
| `showPickbox`      | Pickbox im Fadenkreuz anzeigen                                |              |
| `apertureSize`     | Halbe Kantenlänge des Fangbereichs in px                       | APERTURE     |
| `showApertureBox`  | Fangbereich bei Punkt-Aufforderungen als Quadrat anzeigen      | APBOX        |
| `snapMarkerSize`   | Halbe Größe des Fangmarkers in px                              | AUTOSNAPSIZE |
| `snapMarker`       | Fangmarker anzeigen                                            | AUTOSNAP     |
| `snapTooltip`      | Tooltip mit dem Modusnamen anzeigen                            | AUTOSNAP     |
| `snapMagnet`       | Fadenkreuz springt auf den Fangpunkt (und auf Polar- und Objektfangspuren) | AUTOSNAP |
| `snapPreview`      | Fangpunkt-Vorschau der Objekte unter dem Fangbereich           | (keine)      |
| `previewColor`     | Farbe von Fangpunkt-Vorschau und Gummiband, bei Hell / Dunkel  |              |
| `polarTolerance`   | Größter Abstand des Cursors von einer Polar- oder Objektfangspur in px |      |
| `trackingAcquireDelay` | Verweildauer in ms, bis ein Fangpunkt für die Objektfangspuren erfasst (bzw. wieder entfernt) wird | (keine) |
| `gridMinSpacing`   | Kleinster Abstand der Rasterlinien in px; enger wird das Raster gröber |      |
| `gridColor`        | Farben der Neben- und Hauptlinien des Rasters, bei Hell / Dunkel | Optionen → Farben |
| `ucsIcon`          | BKS-Symbol anzeigen                                            | UCSICON Ein/Aus |
| `ucsIconAtOrigin`  | BKS-Symbol am Nullpunkt, solange es dort passt; aus = immer unten links | UCSICON Ursprung / Kein Ursprung |
| `ucsIconSize`      | Länge der Achsen des BKS-Symbols in px                         | UCSICON Eigenschaften |
| `ucsIconLabelSize` | Schriftgröße der Achsenbeschriftung „X“/„Y“ in px              | UCSICON Eigenschaften |
| `ucsIconOpacity`   | Deckkraft des BKS-Symbols (0–1), damit es sich von gezeichneten Linien abhebt |  |

Die Startwerte der Schalter in der Statuszeile und ihrer Menüs (gelten nach jedem
Neuladen):

- `DEFAULT_SNAP_SETTINGS`: OFANG `enabled` und die Fangmodi `modes` (OSMODE).
- `DEFAULT_TRACKING_MODES`: ORTHO `ortho` und die Polarspur `polar` mit `enabled`,
  `incrementAngle` (POLARANG) und `additionalAngles` (POLARADDANG).
- `POLAR_INCREMENTS`: die Winkelschritte im POLAR-Menü.
- `DEFAULT_OBJECT_TRACKING_SETTINGS`: OTRACK `enabled` (F11) und `allPolarAngles` (Mit
  allen Polarwinkeln spuren statt nur orthogonal).
- `DEFAULT_GRID_SETTINGS`: RASTER `enabled` (GRIDMODE), `spacing` (GRIDUNIT),
  `majorEvery` (GRIDMAJOR).

## Noch nicht umgesetzt

- Rechtsklick bei den Punkt-Aufforderungen (AutoCAD: Kontextmenü bzw. wie Enter).
- **Grip-Funktionen** (Ziehen an Grips) und alle anderen Bearbeitungsbefehle wie Löschen,
  Gruppieren oder Kopieren.
- Gruppenauswahl ausschalten (AutoCAD Ctrl+Shift+A), um einzelne Gruppenmitglieder zu
  wählen.
- Zwischen überlappenden Objekten unter dem Cursor durchschalten.
- Befehle und Optionen beim Objekte-Wählen in der Kommandozeile eintippen (z. B. `V` für
  „Vorherige“); die Verschiebung merkt sich noch nicht die letzte Eingabe als Vorgabe.
- Beim Objektfang: weitere Modi, darunter Erweiterung (EXT) und Parallel (PAR), sowie
  Spurpunkt (TT) und „Von“ (FROM).
- Bei den Objektfangspuren: Erfassen mit Shift statt durch Verweilen, Schnittpunkte einer
  Spur mit Objekten, Ausrichten der Kanten des bewegten Objekts an den Spuren.
- Bei der Polarspur: Winkel relativ zum letzten Segment, Schnittpunkte der Spur mit
  Objekten.
- Beim Raster: Rasterfang (F9), getrennte Abstände für X und Y, Punktraster, isometrisches
  Raster, Limiten.
- Was in der Statuszeile und ihren Menüs geändert wird (OFANG, Fangmodi, POLAR, ORTHO,
  OTRACK, RASTER), wird noch nicht gespeichert; nach dem Neuladen gelten wieder die Startwerte aus
  den [Einstellungen](#einstellungen).
- Beim BKS-Symbol: eigenes BKS (Befehl BKS, Ursprung verschieben, Drehen) samt Wirkung auf
  Koordinateneingabe, Ortho, Polarspur und Raster; Symbol wählen, Griffe und Kontextmenü;
  Befehl BKSYMBOL zum Umschalten; 3D-Darstellung. Die Größe ist fest in px und wächst nicht
  mit der Zeichenfläche.
- Die Einstellungen im Editor ändern.
