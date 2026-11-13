# Bedienung des CAD-Editors

Maus- und Tastaturbefehle des Editors (`depts/editor/`). Die Bedienung folgt AutoCAD.
Auf dem Mac entspricht **Option (⌥)** der Taste Alt.

Tastenkürzel wirken, solange der Fokus nicht in einem Textfeld liegt.

Der Editor zeigt Pläne an, wählt Objekte aus, zeichnet Linien mit dem Befehl LINIE,
Polylinien mit PLINIE, Kreise mit KREIS, Bögen mit BOGEN, Ellipsen mit ELLIPSE und Rechtecke mit RECHTECK, verschiebt Objekte mit dem Befehl SCHIEBEN und streckt sie an ihren [Grips](#grips) (mit Raster, Objektfang, Polarspur, Ortho, Objektfangspuren, Koordinateneingabe, dynamischer Eingabe und Rückgängig). Gespeichert wird noch nichts; was
sonst noch fehlt, steht am Ende unter [Noch nicht umgesetzt](#noch-nicht-umgesetzt).

## Oberfläche

- **Toolbar** (oben): Buttons **Rückgängig** und **Wiederherstellen**, Name des Plans, Button
  **Zoom Grenzen**, rechts die Auswahlen **Darstellung** (Hell / Dunkel / System, mit
  Sonne, Mond bzw. Bildschirm als Symbol) und **Sprache** (DE / EN). Jede ist ein Button
  mit dem gewählten Wert und **▾**, ihr Name steht nur im Tooltip. Ein Klick öffnet ein
  Menü nach unten; die Wahl dort schließt es, ebenso **Esc** oder ein Klick daneben.
  Ganz rechts der Button **Vollbild** (Symbol mit vier Ecken): zeigt den Editor im
  Vollbild des Browsers. Im Vollbild wechselt er zu **Vollbild beenden** (Ecken nach
  innen); verlassen lässt es sich auch, indem man **Esc gedrückt hält**, oder über den
  Browser. Ein kurzer Druck auf Esc beendet das Vollbild nicht, er wirkt wie sonst im
  Editor (z. B. Befehl abbrechen). Kann die Seite Esc nicht für sich reservieren (Keyboard
  Lock, das gibt es nur in Chrome, Edge und anderen Chromium-Browsern, nicht in Safari und
  Firefox), ist der Button ausgegraut und ohne Funktion; sein Tooltip nennt den Grund. Kann
  die Seite gar nicht ins Vollbild (z. B. in einem iframe ohne Erlaubnis), fehlt der Button.
- **Werkzeugleiste** (unter der Toolbar, waagrecht): ein Symbol-Button je Befehl, gruppiert wie in
  AutoCAD: **Zeichnen** mit **Linie** (Befehl [LINIE](#befehl-linie)), **Polylinie**
  (Befehl [PLINIE](#befehl-plinie)), **Kreis** (Befehl [KREIS](#befehl-kreis)), **Bogen**
  (Befehl [BOGEN](#befehl-bogen)), **Ellipse** (Befehl [ELLIPSE](#befehl-ellipse)) und
  **Rechteck** (Befehl [RECHTECK](#befehl-rechteck)), daneben nach einer
  Trennlinie **Ändern** mit **Verschieben** (Befehl [SCHIEBEN](#befehl-schieben)). Der Name
  steht im Tooltip, z. B. `Linie (LINIE)`. Der Button des laufenden Befehls bleibt gedrückt; ein
  weiterer Klick darauf bewirkt nichts. Ein Klick auf einen anderen bricht den laufenden Befehl
  ab (`*Abbruch*`) und startet den neuen.
  Die Buttons **Kreis**, **Bogen** und **Ellipse** stehen für mehrere Arten (Methoden), das
  Objekt zu zeichnen: Der Button zeigt die zuletzt verwendete (anfangs die erste des Menüs,
  Tooltip z. B. `Bogen: 3 Punkte (BOGEN)`) und startet sie. Der schmale Button **▾** daneben
  (z. B. **Weitere Bogen-Werkzeuge**) öffnet ein Menü mit allen Arten, die gewählte ist fett;
  ein Klick auf eine startet sie und legt sie auf den Button. Das Menü schließt auch mit
  **Esc** oder einem Klick daneben. Welche Art zuletzt verwendet wurde, merkt sich der
  Browser, auch über das Neuladen der Seite hinweg. Ein Klick auf eine andere Methode, während der Befehl läuft, bricht ab und
  startet ihn mit ihr neu; dieselbe bewirkt nichts (auch wenn eine Option zu ihr gewechselt
  hat). **Enter** bei `Befehl:` wiederholt den Befehl immer so, wie er getippt beginnt.
  - **Kreis**: **Mittelpunkt, Radius**, **Mittelpunkt, Durchmesser**, **2 Punkte**,
    **3 Punkte** (siehe [KREIS](#befehl-kreis)).
  - **Bogen**: **3 Punkte**, **Start, Zentrum, Ende / Winkel / Länge**, **Start, Ende,
    Winkel / Richtung / Radius**, **Zentrum, Start, Ende / Winkel / Länge** und **Weiter**
    (siehe [BOGEN](#befehl-bogen)).
  - **Ellipse**: **Mittelpunkt**, **Achse, Ende** (siehe [ELLIPSE](#befehl-ellipse)).
- **Zeichenfläche** in der Mitte, mit dem [BKS-Symbol](#bks-symbol) am Nullpunkt bzw.
  unten links.
- **Kommandozeile** unter der Zeichenfläche: oben in Grau die letzte Meldung (z. B.
  `1 gefunden, 2 gesamt`), darunter die aktuelle Aufforderung (z. B. `Befehl:` oder
  `Basispunkt angeben oder [Verschiebung] <Verschiebung>:`). Bei Punkt-Aufforderungen
  erscheint dahinter ein Textcursor und, was man tippt (siehe
  [Eingabe in der Kommandozeile](#eingabe-in-der-kommandozeile)).
- **Statuszeile** (unten): links der Raster-Schalter **RASTER**, der Schalter **ORTHO**, der
  Polarspur-Schalter **POLAR**, der Objektfang-Schalter **OFANG**, der Schalter
  **OTRACK** für die Objektfangspuren und **DYN** für die
  [dynamische Eingabe](#dynamische-eingabe-dyn); alle außer ORTHO mit dem Menü **▾**; rechts die Cursorposition
  `X … Y …` in mm und der Zoom in px/mm.

## Ansicht

| Eingabe                         | Wirkung                                  |
|---------------------------------|------------------------------------------|
| Mausrad / Trackpad scrollen     | Zoomt um den Mauszeiger                  |
| Mittlere Maustaste ziehen       | Verschiebt die Ansicht (Pan)             |
| Leertaste halten + links ziehen | Verschiebt die Ansicht (Pan)             |
| Button **Zoom Grenzen**         | Zeigt den ganzen Plan                    |

Zoomen und Pannen gehen jederzeit, auch während ein Auswahlrechteck offen ist oder ein
Befehl nach einem Punkt fragt. Nur beim Bearbeiten eines [Grips](#grips) wechselt die
Leertaste den Modus; die Ansicht verschiebt dort die mittlere Maustaste.

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

## Rechte Maustaste

Die rechte Maustaste wirkt wie **Enter**, so wie in AutoCAD mit der Rechtsklick-Anpassung
„Letzten Befehl wiederholen“ (ohne Befehl) und „EINGABE“ (im Befehl). Ein Kontextmenü gibt es
noch nicht.

| Situation                                 | Rechtsklick                                         |
|-------------------------------------------|-----------------------------------------------------|
| Kein Befehl (mit oder ohne Auswahl)       | Wiederholt den zuletzt gestarteten Befehl; ist ein Befehlsname getippt, führt er diesen aus. Ohne bisherigen Befehl passiert nichts |
| `Objekte wählen:`                         | Beendet die Auswahl                                 |
| Punkt-Aufforderung                        | Wie Enter: nimmt das Getippte, sonst die Vorgabe des Befehls (z. B. bei SCHIEBEN `Basispunkt` die Option Verschiebung, bei LINIE `Ersten Punkt` das Fortsetzen, beim nächsten Punkt das Beenden, bei einem hot [Grip](#grips) den nächsten Modus, mit dessen Option `Kopieren` das Beenden) |
| Auswahlrechteck oder Lasso offen          | Wird ignoriert, startet also keinen Befehl          |

So lässt sich z. B. LINIE mit einem Rechtsklick beenden und mit einem zweiten Rechtsklick
gleich wieder starten.

## Auswählen

### Überfahren

Beim Überfahren mit der Maus wird hellblau und etwas dicker hervorgehoben, was ein Klick
wählen würde, bei gruppierten Elementen die ganze Gruppe. Bereits gewählte Objekte werden
nicht zusätzlich hervorgehoben.

### Klicken

| Eingabe                 | Wirkung                                             |
|-------------------------|-----------------------------------------------------|
| Klick auf ein Objekt    | Fügt es zur Auswahl hinzu                            |
| Shift + Klick           | Entfernt es aus der Auswahl (auf einem [Grip](#grips) macht er stattdessen den Grip hot) |
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
Punkt, gibt es dort nur einen Grip. Was ein Klick auf einen Grip tut, steht unter
[Grips](#grips).

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

## Grips

Die Grips einer Auswahl (ohne laufenden Befehl) sind Griffe zum Bearbeiten, wie in AutoCAD.
Sind mehr Objekte gewählt, als die Einstellung `gripObjectLimit` erlaubt, zeigt die Auswahl
keine Grips (sie bleibt gewählt und lässt sich mit den Befehlen bearbeiten).
Die Segmentmitten einer Polylinie erscheinen als kleiner Balken längs des Segments, alle
anderen Grips als Quadrat. Größe: Einstellung `gripSize`; Farben: Einstellung `gripColor`.

| Zustand | Bedeutung                                                    | Farbe (`gripColor`) |
|---------|--------------------------------------------------------------|---------------------|
| warm    | Grip eines gewählten Objekts                                 | `warm`              |
| hover   | Grip unter dem Cursor; ein Klick würde ihn bearbeiten        | `hover`             |
| hot     | Grip wird gerade bearbeitet, oder ist mit Shift + Klick dafür vorgemerkt | `hot`    |

Ein Grip ist getroffen, sobald die Pickbox ihn berührt. Er hat dann Vorrang vor dem Objekt
darunter (kein Überfahren-Effekt), und das Fadenkreuz springt auf den Grip (Einstellung
`snapMagnet`). **Shift + Klick** auf einen Grip merkt ihn vor (siehe
[Mehrere Grips zusammen](#mehrere-grips-zusammen)); um ein Objekt aus der Auswahl zu entfernen,
klickt man mit Shift auf seine Kontur abseits der Grips.

### Strecken

1. **Klick auf einen Grip** macht ihn hot. Die Kommandozeile fragt
   `** STRECKEN ** Streckpunkt angeben oder [BAsispunkt/Kopieren/Zurück/eXit]:` (zu den
   Optionen siehe [Grip-Optionen](#grip-optionen)), die Auswahl und ihre Grips bleiben sichtbar.
2. **Zielpunkt angeben.** Eine Vorschau zeigt die betroffenen Objekte so, wie sie nach einem
   Klick aussähen; die Originale sind solange grau, ein gestricheltes Gummiband läuft vom Grip
   zum Cursor. Der Punkt wird wie bei SCHIEBENs zweitem Punkt angegeben: Klick mit
   [Objektfang](#objektfang-ofang), [Polarspur](#polarspur-polar), [Ortho](#ortho-ortho) und
   [Objektfangspuren](#objektfangspuren-otrack), [dynamische Eingabe](#dynamische-eingabe-dyn)
   (Abstand und Winkel ab dem Grip) oder getippt wie unter
   [Eingabe in der Kommandozeile](#eingabe-in-der-kommandozeile) (`@dx,dy` und die direkte
   Distanzeingabe messen ab dem Grip).
3. Das Strecken ist ein Rückgängig-Schritt (`Rückgängig: STRECKEN`). Die Objekte **bleiben
   gewählt**, ihre Grips stehen an der neuen Stelle.

**Grips als Fangpunkte:** Solange ein Grip bearbeitet wird (in jedem Modus), hält ein anderer
Grip der Auswahl unter dem Cursor den Punkt fest, auch bei **ausgeschaltetem** Objektfang. Er
erscheint dann in der Farbe `hover`, das Fadenkreuz springt darauf (Einstellung `snapMagnet`);
einen eigenen Fangmarker gibt es dafür nicht. Der Trefferbereich ist derselbe wie beim Anklicken
eines Grips. Findet der Objektfang dort einen Punkt, gilt dieser (mit Marker); der hot Grip
selbst fängt nicht.

Statt zweimal zu klicken, lässt sich der Grip auch **ziehen**: Taste auf dem Grip drücken,
ziehen, loslassen. Das Loslassen setzt den Zielpunkt, sobald die Maus weiter als
`DRAG_THRESHOLD_PX` (`src/cad/editor/SelectionEditor.ts`) bewegt wurde; sonst bleibt der Grip
hot und wartet auf den nächsten Klick.

**Esc** bricht ab (`*Abbruch*`), die Auswahl bleibt; erst ein zweites Esc hebt sie auf.
**Enter**, die **Leertaste** und der **Rechtsklick** wechseln den [Modus](#grip-modi). Bleibt
der Grip, wo er war, oder kann er nicht dorthin (siehe Tabelle), ändert sich nichts und es
entsteht kein Rückgängig-Schritt.

| Grip                                               | Wirkung                                                         |
|----------------------------------------------------|-----------------------------------------------------------------|
| Linienende, Polylinien-Ecke, Bézier-Ende           | Verschiebt diesen Punkt, der Rest bleibt                         |
| Linienmitte                                        | Verschiebt die ganze Linie                                       |
| Segmentmitte einer Polylinie                       | Verschiebt das Segment parallel (seine beiden Ecken)             |
| Zentrum von Kreis, Ellipse, Bogen                  | Verschiebt das Objekt                                            |
| Quadrant eines Kreises                             | Ändert den Radius: Abstand vom Zentrum zum Zielpunkt; nicht aufs Zentrum |
| Quadrant einer Ellipse                             | Ändert den Radius dieser Achse (Abstand zum Zentrum), die Drehung bleibt; nicht aufs Zentrum |
| Anfang oder Ende eines Bogens                      | Neuer Bogen durch das andere Ende, die bisherige Bogenmitte und den Zielpunkt; nicht auf deren Gerade |
| Bogenmitte                                         | Neuer Bogen durch beide Enden und den Zielpunkt; nicht auf deren Gerade |
| Bézier-Kontrollpunkt                               | Verschiebt nur diesen Kontrollpunkt                              |

Liegen Grips mehrerer **gewählter** Objekte an derselben Stelle, werden alle zusammen
gestreckt (z. B. die gemeinsame Ecke zweier Linien). Wie in AutoCAD ändert sich sonst kein
Objekt: Nutzt ein nicht bearbeitetes Objekt einen bewegten Punkt mit, behält es eine Kopie
des Punkts an der alten Stelle, so wie bei [SCHIEBEN](#befehl-schieben). Zwei Positionen
gelten als gleich, wenn sie sich um weniger als `SAME_POSITION`
(`src/cad/editor/commands/elementEdits.ts`) unterscheiden.

### Mehrere Grips zusammen

Mehrere Grips lassen sich gemeinsam strecken, wie in AutoCAD; was zwischen ihnen liegt, behält
dabei seine Form (z. B. zwei Ecken einer Polylinie samt der Kante dazwischen).

1. **Shift + Klick** auf einen Grip macht ihn hot, ohne das Bearbeiten zu starten; ein weiterer
   Shift + Klick macht ihn wieder warm. So nacheinander alle gewünschten Grips wählen, auch von
   verschiedenen Objekten.
2. **Klick ohne Shift** auf einen Grip startet das Strecken. Dieser Grip ist der Basispunkt,
   alle hot Grips gehen um dieselbe Strecke mit. Auch ein bisher warmer Grip darf der Basispunkt
   sein, er wird dann mitgestreckt.

**Esc** macht zuerst die vorgemerkten Grips wieder warm, erst das nächste Esc hebt die Auswahl
auf. Die Vormerkung bleibt, wenn weitere Objekte gewählt werden; sie endet, wenn das Bearbeiten
endet oder abgebrochen wird oder ein Befehl startet.

Sind von einem Objekt mehrere Grips hot, gilt:

- Der Grip, der das ganze Objekt verschiebt (Linienmitte, Zentrum), nimmt es als Ganzes mit;
  seine übrigen hot Grips ändern dann nichts mehr an der Form.
- Bei einem Bogen läuft der neue Bogen durch Anfang, Mitte und Ende, jeweils an der neuen Stelle,
  wenn der Grip hot ist, sonst an der alten. Sind alle drei hot, wird der Bogen verschoben.
- Ein Bézier-Kontrollpunkt, dessen Endpunkt ebenfalls hot ist, wandert mit dem Endpunkt mit.

Die anderen Modi (SCHIEBEN, DREHEN, …) wirken ohnehin auf die ganze Auswahl; dort zählt nur,
welcher Grip der Basispunkt ist.

### Grip-Menü

Manche Grips können mehr als strecken (in AutoCAD „multifunktionale Grips“). Bleibt der Cursor
auf einem solchen Grip stehen, ohne zu klicken, öffnet sich nach kurzer Zeit (Einstellung
`gripMenuDelay`) ein kleines Menü direkt am Grip; die Einstellung `gripMenu` schaltet es ab.
Ein Klick auf einen Eintrag führt ihn aus. Um das Menü liegt ein unsichtbarer Rand
(`MENU_REACH_PX` in `src/ui/GripMenu.ts`), in dem es offen bleibt, damit der Weg vom Grip zum
Menü nicht genau getroffen werden muss. Das Menü schließt sich, wenn der Cursor auf der
Zeichenfläche vom Grip weg bewegt wird, bei **Esc** (die Auswahl bleibt), bei jeder anderen
Taste und bei einem Klick in die Zeichenfläche; ein Klick auf den Grip selbst streckt wie immer.

| Grip                                   | Einträge                                                        |
|----------------------------------------|-----------------------------------------------------------------|
| Ende einer Linie                       | **Strecken**, **Länge**                                         |
| Anfang oder Ende eines Bogens          | **Strecken**, **Länge**                                         |
| Mitte eines Bogens                     | **Strecken**, **Radius**                                        |
| Ecke einer Polylinie                   | **Strecken**, **Scheitelpunkt hinzufügen**, **Scheitelpunkt entfernen** |
| Segmentmitte einer Polylinie           | **Strecken**, **Scheitelpunkt hinzufügen**                      |

Alle anderen Grips (Linienmitte, Zentren, Quadranten, Bézier-Punkte) haben kein Menü, ebenso
ein Grip, den sich mehrere gewählte Objekte teilen.

| Eintrag | Aufforderung | Wirkung |
|---------|--------------|---------|
| Strecken | wie [Strecken](#strecken) | Wie ein Klick auf den Grip |
| Länge | `** LÄNGE ** Endpunkt angeben:` | Linie: das Ende wandert entlang der Linie zum Lotfußpunkt des angegebenen Punkts, die Richtung bleibt; hinter dem anderen Ende gibt es keine Linie. Bogen: das Ende wandert auf seinem Kreis zum Winkel des Punkts, Zentrum und Radius bleiben |
| Radius | `** RADIUS ** Radius angeben:` | Getippte Zahl oder Abstand vom Zentrum zu einem Punkt: neuer Radius des Bogens, Zentrum und Winkel bleiben |
| Scheitelpunkt hinzufügen | `** SCHEITELPUNKT HINZUFÜGEN ** Neuen Scheitelpunkt angeben:` | Neue Ecke am angegebenen Punkt: bei einer Segmentmitte in diesem Segment, bei einer Ecke im Segment danach; an der ersten Ecke einer offenen Polylinie davor, an der letzten dahinter, so wächst sie an beiden Enden |
| Scheitelpunkt entfernen | (keine) | Entfernt die Ecke sofort; nur angeboten, solange danach noch 2 Ecken (geschlossen: 3) bleiben |

Die Aktionen zeigen eine Vorschau wie das Strecken, nehmen ihren Punkt mit Objektfang,
Polarspur und getippten Koordinaten und sind je ein Rückgängig-Schritt (`Rückgängig: LÄNGE`,
`RADIUS`, `SCHEITELPUNKT HINZUFÜGEN`, `SCHEITELPUNKT ENTFERNEN`); die Auswahl bleibt. Sie haben
keine Optionen. Enter, Leertaste oder Rechtsklick wechseln von dort zu den
[Grip-Modi](#grip-modi) weiter.

Ohne Menü geht es auch: Ist ein Grip hot und fragt STRECKEN nach dem Streckpunkt, schaltet die
**Strg**-Taste (allein gedrückt) durch seine Aktionen, wie in AutoCAD, z. B. STRECKEN → LÄNGE →
STRECKEN. „Scheitelpunkt entfernen“ ist nicht dabei, das gibt es nur im Menü.

### Grip-Modi

Solange ein Grip hot ist, wechseln **Enter**, die **Leertaste** oder ein **Rechtsklick** (ohne
getippten Text) zum nächsten Modus, wie in AutoCAD, und nach dem letzten wieder zum ersten. Der
hot Grip bleibt der Basispunkt. Anders als STRECKEN wirken die übrigen Modi auf die **ganze
Auswahl**; ihre Vorschau zeigt alle gewählten Objekte, die Originale sind solange grau.

| Modus     | Aufforderung                                | Eingabe und Wirkung                                             |
|-----------|---------------------------------------------|-----------------------------------------------------------------|
| STRECKEN  | `** STRECKEN ** Streckpunkt angeben oder […]:` | Siehe [Strecken](#strecken)                                  |
| SCHIEBEN  | `** SCHIEBEN ** Verschiebepunkt angeben oder […]:` | Punkt: verschiebt die Auswahl um (Punkt − Grip), wie [SCHIEBEN](#befehl-schieben) |
| DREHEN    | `** DREHEN ** Drehwinkel angeben oder […]:` | Getippte Zahl: Winkel in Grad, gegen den Uhrzeigersinn. Punkt: die Richtung vom Grip zum Punkt ist der Winkel. Dreht die Auswahl um den Grip |
| SKALIEREN | `** SKALIEREN ** Skalierfaktor angeben oder […]:` | Getippte Zahl: Faktor (z. B. `0.5`, `2`). Punkt: sein Abstand vom Grip in mm ist der Faktor (wie in AutoCAD, daher meist getippt). Skaliert die Auswahl vom Grip aus |
| SPIEGELN  | `** SPIEGELN ** Zweiten Punkt angeben oder […]:` | Punkt: spiegelt die Auswahl an der Linie vom Grip zum Punkt; das Original bleibt nicht erhalten |

Punkte werden wie beim Strecken angegeben (Klick mit Objektfang, Polarspur, Ortho,
Objektfangspuren, getippte Koordinaten). Beim Drehwinkel zeigt die
[dynamische Eingabe](#dynamische-eingabe-dyn) das Winkelfeld allein (beim Bezugswinkel ohne
Basispunkt keines, die Zahl geht dort in die Kommandozeile); ein Text, der kein Winkel ist,
meldet `Erfordert gültigen numerischen Winkel oder
zweiten Punkt.`. Ein Faktor muss positiv sein (`Wert muss positiv und ungleich Null sein.`).
Vielfache von 90° drehen exakt, ohne Rundungsreste in den Koordinaten.

Jeder Modus ist ein Rückgängig-Schritt (`Rückgängig: SCHIEBEN`, `DREHEN`, `SKALIEREN`,
`SPIEGELN`). Ein Drehwinkel von 0° (oder ein Vielfaches von 360°), der Faktor 1 und ein
Verschieben um nichts ändern nichts und hinterlassen keinen Schritt. Nicht gewählte Objekte
ändern sich auch hier nie: Sie behalten eine Kopie eines mitbenutzten Punkts an der alten
Stelle.

### Grip-Optionen

Jede Aufforderung eines Modus nennt in eckigen Klammern ihre Optionen:
`[BAsispunkt/Kopieren/Zurück/eXit]`, bei DREHEN und SKALIEREN
`[BAsispunkt/Kopieren/Zurück/BEzug/eXit]`. Eine Option wird wie in AutoCAD getippt und mit
Enter oder Leertaste abgeschlossen: mindestens die Großbuchstaben (`BA`, `K`, `Z`, `BE`, `X`),
beliebig weiter ausgeschrieben, Groß-/Kleinschreibung egal. Ein einzelnes `B` reicht nicht,
weil es `BAsispunkt` und `BEzug` meinen könnte. Im englischen Editor heißen sie
`Base point`, `Copy`, `Undo`, `Reference`, `eXit`.

| Option       | Wirkung                                                                              |
|--------------|--------------------------------------------------------------------------------------|
| `BAsispunkt` | Fragt `Basispunkt angeben:`. Der gegebene Punkt ersetzt den Grip als Basispunkt des Modus (Drehpunkt, Anfang des Verschiebevektors, …) und wird als kleines Kreuz markiert; der Grip bleibt hot |
| `Kopieren`   | Die Originale bleiben, jede Eingabe (Punkt, Winkel, Faktor) erzeugt sofort eine Kopie; die Aufforderung zeigt `(mehrere)`, z. B. `** STRECKEN (mehrere) **`. Enter, Leertaste oder Rechtsklick **beenden** dann, statt den Modus zu wechseln |
| `Zurück`     | Nimmt die letzte Kopie oder den zuletzt gewählten Basispunkt zurück; ist nichts mehr da, meldet die Kommandozeile `Nichts zum Zurücknehmen.` |
| `BEzug`      | Nur DREHEN und SKALIEREN, siehe unten                                                |
| `eXit`       | Beendet das Bearbeiten des Grips; schon erzeugte Kopien bleiben                      |

Mit `Kopieren` zeigt die Vorschau die Kopie, die Originale bleiben dabei hervorgehoben und
werden nicht grau. Bei STRECKEN wird nur kopiert, was der Grip streckt, in den anderen Modi die
ganze Auswahl. Kopien bekommen eigene Punkte; teilen sich die Originale einen Punkt, teilen sich
auch ihre Kopien einen. Kopien gruppierter Objekte bilden eine eigene Gruppe mit demselben
Namen. Alle Kopien eines Durchgangs sind zusammen **ein** Rückgängig-Schritt, auch wenn **Esc**
das Bearbeiten beendet (die Kopien bleiben).

**`BEzug`** misst gegen einen Bezugswert, statt den Winkel oder Faktor direkt anzugeben:

- **DREHEN:** `Bezugswinkel angeben <0>:` nimmt eine getippte Zahl, Enter für 0 oder zwei
  geklickte Punkte (nach dem ersten fragt die Kommandozeile `Zweiten Punkt angeben:`; der
  Winkel der Linie zwischen beiden zählt). Danach `Neuen Winkel angeben oder […]:`; gedreht wird
  um (neuer Winkel − Bezugswinkel). So lässt sich eine schräge Kante auf einen bestimmten Winkel
  drehen.
- **SKALIEREN:** `Bezugslänge angeben <1.0000>:` nimmt eine getippte Länge, Enter für 1 oder
  zwei geklickte Punkte (ihr Abstand zählt). Danach `Neue Länge angeben oder […]:`, getippt oder
  als Abstand vom Basispunkt zu einem Punkt; der Faktor ist (neue Länge / Bezugslänge). So lässt
  sich mit der Maus skalieren: Bezugslänge an einer Kante abgreifen, dann die neue Länge zeigen.

Der Bezug gilt, bis der Modus wechselt, also auch für alle Kopien. Während nach einem
Basispunkt oder Bezug gefragt wird, gibt es keine Optionen; Esc bricht das Bearbeiten ab.

## Befehl SCHIEBEN

Button **Verschieben** (Pfeilkreuz) in der Werkzeugleiste.

Oder bei `Befehl:` den Namen tippen, `SCHIEBEN` oder `MOVE` (Groß-/Kleinschreibung egal,
in jeder Sprache), und mit **Enter** oder **Leertaste** ausführen. Der Text erscheint in
der Kommandozeile; **Rücktaste** korrigiert, **Esc** verwirft ihn (erst ein zweites **Esc**
hebt die Auswahl auf). Ohne getippten Text behalten Leertaste (Verschieben der Ansicht) und
Esc ihre übliche Bedeutung; **Enter** ohne getippten Text **wiederholt den zuletzt
gestarteten Befehl** (auch einen abgebrochenen), wie in AutoCAD. Ein unbekannter Name meldet
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
getippt, verwirft das erste Esc nur die Eingabe. Ein Rechtsklick wirkt bei den
Punkt-Aufforderungen wie Enter (siehe [Rechte Maustaste](#rechte-maustaste)). Ohne laufenden Befehl macht **Strg/⌘+Z** bzw.
der Button **Rückgängig** das Verschieben rückgängig, **Strg+Y** / **⌘+⇧+Z** bzw.
**Wiederherstellen** stellt es wieder her.

### Eingabe in der Kommandozeile

Bei den Punkt-Aufforderungen tippt die Tastatur direkt in die Kommandozeile, ohne sie
anzuklicken. Mit eingeschalteter [dynamischer Eingabe](#dynamische-eingabe-dyn) geht das
Getippte stattdessen in deren Felder am Fadenkreuz; dort ist beim zweiten Punkt `x,y` bzw.
`abstand<winkel` relativ zum Basispunkt, absolut erst mit `#`. Diese Tabelle gilt so, wenn DYN
aus ist oder die Aufforderung keine Felder zeigt.

**Enter** (oder die **Leertaste**, sobald etwas getippt ist) schließt die
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
Tastenkürzel aus; Strg/⌘-Kürzel, F3, F7, F8, F10, F11 und F12 wirken weiter.

## Befehl LINIE

Zeichnet eine Folge zusammenhängender, aber **einzeln bearbeitbarer** Linien, wie AutoCAD
LINIE. Start mit dem Button **Linie** in der Werkzeugleiste oder durch Tippen von
`LINIE`, `LINE` oder `L` bei `Befehl:` (Enter oder Leertaste). Eine bestehende Auswahl wird
dabei aufgehoben.

1. **`Ersten Punkt angeben:`** Klick (mit [Objektfang](#objektfang-ofang) und
   [Objektfangspuren](#objektfangspuren-otrack)) oder Koordinaten eintippen, wie beim
   Basispunkt von SCHIEBEN. **Enter** ohne Eingabe setzt am Endpunkt der zuletzt mit LINIE,
   [PLINIE](#befehl-plinie) oder [BOGEN](#befehl-bogen) gezeichneten Linie, Polylinie oder des
   Bogens fort (dort, wo er jetzt liegt; bei einer geschlossenen Polylinie an ihrem
   Startpunkt). Nach einem **Bogen** setzt die Linie **tangential** an: Die Richtung steht
   fest, **`Länge der Linie angeben:`** fragt nur noch nach der Länge (eine positive Zahl, oder
   der Abstand vom Endpunkt zu einem Punkt; die dynamische Eingabe zeigt das Abstandsfeld, die
   Vorschau die Linie in dieser Richtung). Danach geht es mit dem nächsten Punkt weiter wie
   sonst. Gibt es nichts zum Fortsetzen (z. B. nach Rückgängig), meldet die Kommandozeile
   `Keine Linie oder kein Bogen zum Fortsetzen.`, die Aufforderung bleibt.
2. **`Nächsten Punkt angeben oder [Zurück]:`**, ab zwei Segmenten
   **`Nächsten Punkt angeben oder [Schließen/Zurück]:`**. Jeder Punkt erzeugt **sofort** eine
   neue Linie vom letzten Punkt aus; sie ist gleich zu sehen und fangbar (z. B. der
   Mittelpunkt des eben gezeichneten Segments). Dann wird wieder gefragt. Hier gilt alles, was
   für den zweiten Punkt von SCHIEBEN beschrieben ist, mit dem **letzten Punkt** an Stelle
   des Basispunkts: [Polarspur](#polarspur-polar), [Ortho](#ortho-ortho), Objektfangspuren,
   `@`-Eingaben, Direkte Distanzeingabe und die
   [dynamische Eingabe](#dynamische-eingabe-dyn) mit Abstand und Winkel. Bis zum Klick zeigt
   eine durchgezogene **Vorschaulinie** vom letzten Punkt zum Punkt, den ein Klick nähme. Ein
   Punkt genau auf dem letzten erzeugt keine Linie.

| Eingabe beim nächsten Punkt  | Wirkung                                                         |
|------------------------------|-----------------------------------------------------------------|
| `Z` (Zurück) + Enter         | Entfernt das letzte Segment; der letzte Punkt springt zurück. Mehrfach möglich bis zum ersten Punkt, danach `Alle Segmente bereits zurückgenommen.` |
| `S` (Schließen) + Enter      | Ab zwei Segmenten: Linie zurück zum ersten Punkt der Folge, der Befehl endet |
| **Enter** ohne Eingabe oder **Rechtsklick** | Beendet den Befehl                               |
| **Esc**                      | Beendet den Befehl (`*Abbruch*`); die gezeichneten Linien bleiben |

Im Englischen heißen die Optionen `Undo` (`U`) und `Close` (`C`). Optionen werden wie in
AutoCAD mit ihrem Anfang erkannt (`Zur` = `Zurück`). Steht ein Großbuchstabe mitten im
Schlüsselwort, beginnt dort das Kürzel (`L` oder `Länge` für `sehnenLänge`); ganz ausgeschrieben
gilt es auch.

- Jedes Segment ist eine eigene Linie mit eigenen Endpunkten; aufeinanderfolgende Linien
  teilen keinen Punkt, ihre Enden liegen nur aufeinander. Neue Linien haben noch keinen Layer
  und den Standardstil.
- Alle Linien eines LINIE-Aufrufs sind **ein** Schritt für Rückgängig (`Rückgängig: LINIE`).
  „Zurück“ wirkt nur innerhalb des laufenden Befehls und lässt sich nicht wiederherstellen.
- Die **Leertaste** ohne getippten Text verschiebt weiter die Ansicht (bewusste Abweichung:
  in AutoCAD wirkt sie wie Enter und würde den Befehl beenden). Ist etwas getippt, schließt sie
  die Eingabe ab.

## Befehl PLINIE

Zeichnet eine **Polylinie**: ein einziges Objekt aus zusammenhängenden Segmenten, wie AutoCAD
PLINIE. Bisher gibt es nur gerade Segmente (siehe [Noch nicht umgesetzt](#noch-nicht-umgesetzt)).
Start mit dem Button **Polylinie** in der Werkzeugleiste oder durch Tippen von `PLINIE`,
`PLINE` oder `PL` bei `Befehl:` (Enter oder Leertaste). Eine bestehende Auswahl wird dabei
aufgehoben.

1. **`Startpunkt angeben:`** wie der erste Punkt von [LINIE](#befehl-linie), auch das
   Fortsetzen mit **Enter** am Endpunkt der zuletzt mit LINIE, PLINIE oder BOGEN gezeichneten
   Linie, Polylinie oder des Bogens (es setzt nur dort an, auch an einem Bogen in freier
   Richtung; die neue Polylinie ist ein eigenes Objekt).
2. **`Nächsten Punkt angeben oder [Zurück]:`**, ab einem Segment
   **`Nächsten Punkt angeben oder [Schließen/sehnenLänge/Zurück]:`**. Jeder Punkt fügt ein
   Segment vom letzten Punkt aus hinzu; Polarspur, Ortho, Objektfangspuren, `@`-Eingaben,
   Direkte Distanzeingabe und dynamische Eingabe wirken wie beim nächsten Punkt von LINIE. Ein
   Punkt genau auf dem letzten fügt nichts hinzu.

Anders als bei LINIE kommt die Polylinie erst ins Dokument, wenn der Befehl endet. Bis dahin
zeigt eine **Vorschau** in durchgezogenen Linien die bisherigen Segmente und das Segment vom
letzten Punkt zum Punkt, den ein Klick nähme. Die bisherigen Segmente sind deshalb noch **nicht
fangbar** (wie in AutoCAD, wo die Polylinie während des Befehls noch nicht existiert); auch
Objektfangspuren lassen sich an ihnen nicht erfassen.

| Eingabe beim nächsten Punkt  | Wirkung                                                         |
|------------------------------|-----------------------------------------------------------------|
| `Z` (Zurück) + Enter         | Entfernt das letzte Segment; der letzte Punkt springt zurück. Mehrfach möglich bis zum Startpunkt, danach `Alle Segmente bereits zurückgenommen.` |
| `S` (Schließen) + Enter      | Ab einem Segment: schließt die Polylinie mit einem Segment zurück zum Startpunkt, der Befehl endet. Liegt der letzte Punkt schon auf dem Startpunkt, ersetzt das schließende Segment das letzte |
| `L` (sehnenLänge) + Enter    | Ab einem Segment: fragt `Länge der Linie angeben:` (siehe unten) |
| **Enter** ohne Eingabe oder **Rechtsklick** | Beendet den Befehl; die Polylinie bleibt offen   |
| **Esc**                      | Beendet den Befehl (`*Abbruch*`); die gezeichnete Polylinie bleibt |

Im Englischen heißen die Optionen `Undo` (`U`), `Close` (`C`) und `Length` (`L`), die
Aufforderungen `Specify start point:`, `Specify next point or [Close/Length/Undo]:` und
`Specify length of line:`.

**`Länge der Linie angeben:`** fügt ein Segment der angegebenen Länge in **Richtung des
vorigen Segments** an (wie AutoCAD: die Abfrage eines Abstands ab dem letzten Punkt):

- Eine getippte **Zahl** + Enter ist die Länge.
- Ein **Klick** (mit Objektfang, Polarspur, Ortho und Objektfangspuren) oder ein getippter
  **Punkt** (`x,y`, `@dx,dy`, `abstand<winkel`) gibt die Länge als Abstand vom letzten Punkt
  zu diesem Punkt; seine Richtung zählt nicht.
- Die Vorschau zeigt das entstehende Segment, so lang wie der Abstand Cursor–letzter Punkt,
  dazu ein gestricheltes **Gummiband** vom letzten Punkt zum Cursor, mit dem gemessen wird.
- Mit der [dynamischen Eingabe](#dynamische-eingabe-dyn) gibt es nur **ein Feld**, den
  Abstand (mit Bemaßungseingabe auf einer Maßlinie entlang des Gummibands, ohne Winkelbogen).
  `,` und `<` bleiben im Feld; das Getippte gilt dann als Punkt. Tab schaltet weiter die
  Fangpunkte durch.
- Nur eine **positive** Länge wird genommen. `0`, eine negative Zahl oder ein Punkt auf dem
  letzten Punkt melden `Wert muss positiv und ungleich Null sein.`; anderer Text und Enter
  ohne Eingabe melden `Erfordert numerischen Abstand oder zweiten Punkt.` Die Abfrage bleibt in
  beiden Fällen stehen. Optionen gibt es hier nicht; **Esc** beendet den Befehl wie sonst
  auch, die Polylinie bleibt.
- Danach geht es mit `Nächsten Punkt angeben` weiter; „Zurück“ nimmt das Segment wieder weg.

- Endet der Befehl mit nur dem Startpunkt (ohne Segment), entsteht nichts.
- Die Polylinie hat eigene Punkte, die sie mit keinem anderen Objekt teilt, noch keinen Layer
  und den Standardstil.
- Sie ist **ein** Schritt für Rückgängig (`Rückgängig: PLINIE`). „Zurück“ wirkt nur innerhalb
  des laufenden Befehls.
- Die **Leertaste** ohne getippten Text verschiebt weiter die Ansicht, wie bei LINIE.

## Befehl KREIS

Zeichnet einen **Kreis**, wie AutoCAD KREIS; danach endet der Befehl. Start mit dem Button
**Kreis** in der Werkzeugleiste (bzw. einer Methode in seinem Menü **▾**) oder durch Tippen
von `KREIS`, `K`, `CIRCLE` oder `C` bei `Befehl:`. Eine bestehende Auswahl wird dabei
aufgehoben. Die Methoden des Menüs fragen gleich so, wie es sonst die Optionen tun:
**Mittelpunkt, Radius** wie getippt, **Mittelpunkt, Durchmesser** nach dem Mittelpunkt gleich
nach dem Durchmesser, **2 Punkte** und **3 Punkte** wie nach `2P` bzw. `3P`.

1. **`Zentrum für Kreis angeben oder [3P/2P]:`** – der Mittelpunkt, mit Objektfang,
   Objektfangspuren und Koordinateneingabe wie der erste Punkt von [LINIE](#befehl-linie).
2. **`Radius für Kreis angeben oder [Durchmesser]:`** – eine Abfrage eines Abstands ab dem
   Mittelpunkt, wie `Länge der Linie angeben:` bei [PLINIE](#befehl-plinie): eine getippte
   **Zahl** ist der Radius, ein **Klick** oder getippter **Punkt** gibt ihn als Abstand vom
   Mittelpunkt (Objektfang, Polarspur, Ortho und Objektfangspuren wirken, auch die Direkte
   Distanzeingabe). Die dynamische Eingabe zeigt nur das Abstandsfeld.
   `D` (Durchmesser) + Enter fragt stattdessen **`Durchmesser für Kreis angeben:`**, gemessen
   genauso; der Radius ist dann die Hälfte.

Während des Radius oder Durchmessers zeigt eine **Vorschau** den Kreis, den ein Klick ergäbe,
dazu ein gestricheltes **Gummiband** vom Mittelpunkt zum Cursor.

| Eingabe beim Mittelpunkt | Wirkung                                                         |
|--------------------------|-----------------------------------------------------------------|
| `2P` + Enter             | Kreis über zwei Endpunkte eines Durchmessers: `Ersten Endpunkt für Kreisdurchmesser angeben:`, `Zweiten Endpunkt für Kreisdurchmesser angeben:` (ab dem ersten Punkt, mit Vorschau) |
| `3P` + Enter             | Kreis durch drei Punkte: `Ersten Punkt auf Kreis angeben:`, `Zweiten …`, `Dritten …` (jeweils ab dem vorigen Punkt; beim dritten mit Vorschau) |

- `3P` und `2P` müssen ganz getippt werden (Groß-/Kleinschreibung egal); sie heißen in beiden
  Sprachen so.
- Nur ein **positiver** Radius oder Durchmesser wird genommen (sonst `Wert muss positiv und
  ungleich Null sein.`); die Abfrage bleibt stehen.
- **Vorgabe:** Nach dem ersten Kreis nennt die Aufforderung den Radius des zuletzt gezeichneten
  Kreises (egal mit welcher Methode) in spitzen Klammern, z. B. `Radius für Kreis angeben oder
  [Durchmesser] <25.0000>:`, beim Durchmesser das Doppelte (`Durchmesser für Kreis angeben
  <50.0000>:`). **Enter** ohne Eingabe (oder ein Rechtsklick) zeichnet den Kreis mit diesem
  Wert. Solange es noch keinen gibt, meldet Enter `Erfordert numerischen Abstand oder zweiten
  Punkt.`. Die Vorgabe gilt bis zum Neuladen der Seite und zeigt `DEFAULT_VALUE_DECIMALS`
  Nachkommastellen (`src/cad/editor/tools/DrawingMemory.ts`).
- Punkte, die keinen Kreis ergeben (bei 2P auf dem ersten Punkt, bei 3P auf dem vorigen oder
  alle drei auf einer Geraden), werden nicht genommen: `Mit diesem Punkt ergibt sich kein
  Kreis.`, die Abfrage bleibt.
- **Esc** bricht bei jeder Abfrage ab (`*Abbruch*`), ohne Kreis.
- Der Kreis hat einen eigenen Mittelpunkt, noch keinen Layer und den Standardstil, und ist
  **ein** Schritt für Rückgängig (`Rückgängig: KREIS`).

Im Englischen heißen die Aufforderungen `Specify center point for circle or [3P/2P]:`,
`Specify radius of circle or [Diameter]:` und `Specify diameter of circle:`, die Option
`Diameter` (`D`).

## Befehl BOGEN

Zeichnet einen **Kreisbogen**, wie AutoCAD BOGEN; danach endet der Befehl. Start mit dem Button
**Bogen** in der Werkzeugleiste (bzw. einer Methode in seinem Menü **▾**) oder durch Tippen von
`BOGEN`, `B`, `ARC` oder `A` bei `Befehl:`. Eine bestehende Auswahl wird dabei aufgehoben. Es
gibt elf Methoden: **3 Punkte** (die Vorgabe); um einen Mittelpunkt **Start, Zentrum,
Ende**, **Start, Zentrum, Winkel** und **Start, Zentrum, Länge**, jeweils auch mit dem
Mittelpunkt zuerst (**Zentrum, Start, …**); und über Start- und Endpunkt **Start, Ende,
Winkel**, **Start, Ende, Richtung** und **Start, Ende, Radius**; und **Weiter**, tangential
am zuletzt Gezeichneten.

### 3 Punkte

1. **`Startpunkt für Bogen angeben oder [Zentrum]:`** – der Anfang des Bogens, mit Objektfang,
   Objektfangspuren und Koordinateneingabe wie der erste Punkt von [LINIE](#befehl-linie).
   `Z` (Zentrum) + Enter fragt [zuerst nach dem Mittelpunkt](#zentrum-zuerst), **Enter** ohne
   Eingabe [setzt am zuletzt Gezeichneten fort](#weiter).
2. **`Zweiten Punkt für Bogen angeben oder [Zentrum/Endpunkt]:`** – ein beliebiger Punkt, durch den der
   Bogen läuft (nicht sein Mittelpunkt). Gemessen ab dem Startpunkt (Polarspur, Ortho, Direkte
   Distanzeingabe, `@`); ein gestricheltes **Gummiband** läuft vom Startpunkt zum Cursor.
   `Z` (Zentrum) + Enter wechselt zu [Start, Zentrum, Ende](#start-zentrum-ende), `E`
   (Endpunkt) + Enter zu [Start, Ende](#start-ende).
3. **`Endpunkt für Bogen angeben:`** – das Ende des Bogens, gemessen ab dem zweiten Punkt. Eine
   **Vorschau** zeigt den Bogen, den ein Klick ergäbe.

- Der Bogen läuft vom Startpunkt **über den zweiten Punkt** zum Endpunkt. Die Reihenfolge der
  Punkte bestimmt damit die Richtung (im oder gegen den Uhrzeigersinn) und, ob es der kurze
  oder der lange Teil des Kreises ist.
- Punkte, die keinen Bogen ergeben (der zweite auf dem Startpunkt, der dritte auf einem der
  beiden ersten oder alle drei auf einer Geraden), werden nicht genommen: `Mit diesem Punkt
  ergibt sich kein Bogen.`, die Abfrage bleibt. Die Vorschau zeigt dort nichts. Das gilt bei
  allen Methoden unten ebenso.

### Start, Zentrum, Ende

Start mit **Start, Zentrum, Ende** im Menü **▾** des Buttons **Bogen** (der Befehl fragt dann
nach dem Startpunkt gleich nach dem Mittelpunkt) oder mit `Z` beim zweiten Punkt.

1. **`Startpunkt für Bogen angeben oder [Zentrum]:`** – wie oben.
2. **`Mittelpunkt für Bogen angeben:`** – das Zentrum des Kreises, gemessen ab dem Startpunkt,
   mit Gummiband. Sein Abstand zum Startpunkt ist der **Radius**.
3. **`Endpunkt für Bogen angeben (Strg wechselt die Richtung) oder [Winkel/sehnenLänge]:`** – der Punkt gibt nur die
   **Richtung** an, in der der Bogen endet: Er endet auf seinem Kreis, auf dem Strahl vom
   Mittelpunkt durch den Punkt; der Punkt selbst muss nicht auf dem Kreis liegen. Gemessen ab
   dem Mittelpunkt (eine Eingabe wie `@100<90` oder die Polarspur geben also den Endwinkel; der
   Abstand spielt keine Rolle).
   Eine **Vorschau** zeigt den Bogen, dazu ein Gummiband vom Mittelpunkt zum Cursor.
   `W` (Winkel) + Enter wechselt zu [Start, Zentrum, Winkel](#start-zentrum-winkel), `L`
   (sehnenLänge) + Enter zu [Start, Zentrum, Länge](#start-zentrum-länge).

- Der Bogen läuft vom Startpunkt **gegen den Uhrzeigersinn**. Die **Strg**-Taste (allein
  gedrückt) kehrt die Richtung um, ein weiterer Druck wieder zurück; die Vorschau folgt sofort,
  schon Getipptes bleibt. Der nächste Bogen läuft wieder gegen den Uhrzeigersinn.
  **Abweichung von AutoCAD:** dort gilt die andere Richtung nur, solange Strg gehalten wird;
  hier schaltet ein Druck um, weil Strg + Klick auf dem Mac ein Rechtsklick ist (und der wirkt
  wie Enter).
- Punkte, die keinen Bogen ergeben, werden mit derselben Meldung nicht genommen, die Abfrage bleibt: der Mittelpunkt auf
  dem Startpunkt, das Ende im Mittelpunkt oder auf dem Strahl durch den Startpunkt (das wäre
  ein voller Kreis).

### Start, Zentrum, Winkel

Start mit **Start, Zentrum, Winkel** im Menü **▾** des Buttons **Bogen** (der Befehl fragt dann
nach dem Mittelpunkt gleich nach dem Winkel) oder mit `W` beim Endpunkt von
[Start, Zentrum, Ende](#start-zentrum-ende).

1. **`Startpunkt für Bogen angeben oder [Zentrum]:`** und 2. **`Mittelpunkt für Bogen
   angeben:`** – wie bei Start, Zentrum, Ende; der Abstand ist der Radius.
3. **`Eingeschlossenen Winkel angeben (Strg wechselt die Richtung):`** – der Winkel des Bogens
   am Mittelpunkt, in Grad:
   - eine getippte **Zahl**: positiv läuft der Bogen vom Startpunkt gegen den Uhrzeigersinn,
     **negativ im Uhrzeigersinn** (`90`, `-180`); Winkel über 360 zählen ohne die vollen
     Drehungen (`450` wie `90`);
   - ein **Klick** oder getippter **Punkt**: der Winkel ist die **Richtung vom Mittelpunkt zum
     Punkt, gemessen ab der X-Achse** wie jeder Winkel (nach oben 90°, nach links 180°, nach
     unten 270°), **nicht** ab dem Startpunkt, wie in AutoCAD. Er ist nie negativ, der Bogen
     läuft also gegen den Uhrzeigersinn. Objektfang, Polarspur, Ortho und Objektfangspuren
     wirken ab dem Mittelpunkt.

   Eine **Vorschau** zeigt den Bogen für die Richtung zum Cursor, dazu ein Gummiband vom
   Mittelpunkt. Die [dynamische Eingabe](#dynamische-eingabe-dyn) zeigt das Winkelfeld allein;
   ein getippter Winkel zeigt sich sofort in der Vorschau, auch ein negativer.

- Die **Strg**-Taste (allein gedrückt) kehrt die Richtung um, auch die eines negativen Winkels;
  ein weiterer Druck wieder zurück (dieselbe Abweichung von AutoCAD wie oben). Wer mit `W` vom
  Endpunkt kommt, behält die dort gewählte Richtung.
- `0`, `360` und andere volle Drehungen ergeben keinen Bogen: `Winkel darf nicht 0 oder ein
  Vielfaches von 360 sein.`, ebenso ein Punkt genau rechts vom Mittelpunkt (0°). Enter ohne
  Eingabe oder anderer Text meldet `Erfordert gültigen numerischen Winkel oder zweiten Punkt.`
  Die Abfrage bleibt jeweils stehen.

### Start, Zentrum, Länge

Start mit **Start, Zentrum, Länge** im Menü **▾** des Buttons **Bogen** (der Befehl fragt dann
nach dem Mittelpunkt gleich nach der Sehnenlänge) oder mit `L` beim Endpunkt von
[Start, Zentrum, Ende](#start-zentrum-ende).

1. Startpunkt und 2. Mittelpunkt wie bei Start, Zentrum, Ende.
3. **`Sehnenlänge angeben (Strg wechselt die Richtung):`** – die Länge der **Sehne**, der
   geraden Strecke vom Startpunkt zum Ende des Bogens: eine getippte **Zahl**, oder der
   **Abstand vom Startpunkt** zu einem geklickten oder getippten Punkt (nur der Abstand zählt,
   nicht wo der Punkt liegt; das Ende des Bogens liegt also meist nicht am Cursor). Gemessen
   wie der Radius bei [KREIS](#befehl-kreis), die dynamische Eingabe zeigt das Abstandsfeld.
   Eine **Vorschau** zeigt den Bogen, dazu ein Gummiband vom Startpunkt.

- Der Bogen läuft vom Startpunkt gegen den Uhrzeigersinn und ist der **kürzere** der beiden
  möglichen; eine **negative** Länge gibt den **längeren** (`-500` statt `500`). Eine Sehne so
  lang wie der Durchmesser gibt den Halbkreis.
- **Strg** kehrt die Richtung um, wie oben; wer mit `L` vom Endpunkt kommt, behält die dort
  gewählte Richtung.
- Eine Länge von `0` oder über dem Durchmesser gibt keinen Bogen: `Sehnenlänge darf nicht 0 und
  nicht länger als der Durchmesser sein.` Enter ohne Eingabe oder anderer Text meldet
  `Erfordert numerischen Abstand oder zweiten Punkt.` Die Abfrage bleibt jeweils stehen.

### Zentrum zuerst

Jede der drei Methoden um einen Mittelpunkt gibt es auch mit dem Mittelpunkt vor dem
Startpunkt: **Zentrum, Start, Ende**, **Zentrum, Start, Winkel** und **Zentrum, Start, Länge**
im Menü **▾**, oder `Z` beim Startpunkt.

1. **`Mittelpunkt für Bogen angeben:`** – ein Punkt für sich, wie der Startpunkt sonst.
2. **`Startpunkt für Bogen angeben:`** – gemessen ab dem Mittelpunkt, mit Gummiband; der
   Abstand ist der Radius. Hier gibt es keine Option; ein Punkt auf dem Mittelpunkt wird
   ignoriert.
3. Danach wie bei der Methode mit dem Startpunkt zuerst: der Endpunkt mit seinen Optionen
   `Winkel` und `sehnenLänge`, der Winkel oder die Sehnenlänge.

`Z` beim Startpunkt behält, was die gewählte Methode zuletzt abfragt: aus Start, Zentrum,
Winkel wird Zentrum, Start, Winkel; aus 3 Punkte wird Zentrum, Start, Ende.

### Start, Ende

Start- und Endpunkt stehen fest, der Bogen liegt genau zwischen ihnen; ein dritter Wert
bestimmt, wie stark er sich wölbt. Start mit **Start, Ende, Winkel**, **Start, Ende,
Richtung** oder **Start, Ende, Radius** im Menü **▾** (der Befehl fragt dann nach dem Endpunkt
gleich nach diesem Wert) oder mit `E` beim zweiten Punkt.

1. **`Startpunkt für Bogen angeben oder [Zentrum]:`** – wie oben.
2. **`Endpunkt für Bogen angeben:`** – das Ende des Bogens, gemessen ab dem Startpunkt, mit
   Gummiband. Hier gibt es keine Option; ein Punkt auf dem Startpunkt wird nicht genommen.
3. Nach `E` beim zweiten Punkt: **`Mittelpunkt für Bogen angeben (Strg wechselt die Richtung)
   oder [Winkel/RIchtung/RAdius]:`** – ein Punkt ist der **Mittelpunkt**: Der Bogen läuft dann
   wie bei [Start, Zentrum, Ende](#start-zentrum-ende) vom Startpunkt um ihn herum und endet
   auf dem Strahl zum Endpunkt (der Endpunkt gibt hier also nur die Richtung, wenn er nicht
   auf dem Kreis liegt). `W`, `RI` oder `RA` + Enter fragen stattdessen nach einem der drei
   Werte unten; `R` allein reicht nicht.

| Wert | Aufforderung | Eingabe |
|------|--------------|---------|
| **Winkel** | `Eingeschlossenen Winkel angeben (Strg wechselt die Richtung):` | Der Winkel des Bogens an seinem Mittelpunkt, wie bei [Start, Zentrum, Winkel](#start-zentrum-winkel): positiv gegen den Uhrzeigersinn vom Start zum Ende, negativ im Uhrzeigersinn; über 180° ist es der große Bogen. Gezeigt wird er als Richtung **vom Startpunkt** zum Punkt, ab der X-Achse. |
| **Richtung** | `Tangentenrichtung für Startpunkt des Bogens angeben (Strg wechselt die Richtung):` | Die Richtung, in der der Bogen den Startpunkt verlässt: getippt in Grad ab der X-Achse, oder die Richtung vom Startpunkt zu einem Punkt. Das Gummiband liegt also tangential am Bogen. |
| **Radius** | `Radius für Bogen angeben (Strg wechselt die Richtung):` | Getippt, oder der Abstand **vom Endpunkt** zu einem Punkt. Positiv gibt den kürzeren Bogen gegen den Uhrzeigersinn, **negativ** den längeren. |

- Jede Abfrage zeigt eine **Vorschau** des Bogens; die dynamische Eingabe zeigt beim Radius das
  Abstandsfeld, bei Winkel und Richtung das Winkelfeld. Ein getippter Wert zeigt sich sofort
  in der Vorschau, mit seinem Vorzeichen.
- **Strg** (allein gedrückt) kehrt um: beim Mittelpunkt, beim Winkel und beim Radius die
  Richtung des Bogens (im Uhrzeigersinn), bei der Richtung die Seite, auf der er den Startpunkt
  verlässt (der Rest desselben Kreises). Wer mit einer Option vom Mittelpunkt kommt, behält die
  dort gewählte Richtung.
- Kein Bogen, die Abfrage bleibt: ein Winkel von `0` oder vollen Drehungen (`Winkel darf nicht
  0 oder ein Vielfaches von 360 sein.`), eine Richtung genau zum Endpunkt hin oder von ihm weg
  (`Richtung darf nicht auf der Geraden durch Start- und Endpunkt liegen.`), ein Radius von `0`
  oder unter dem halben Abstand der beiden Punkte (`Radius darf nicht 0 und nicht kleiner als
  der halbe Abstand der Endpunkte sein.`). Ein Mittelpunkt, der keinen Bogen ergibt (auf dem
  Startpunkt, oder mit dem Endpunkt auf dem Strahl durch den Startpunkt), wird nicht genommen
  (`Mit diesem Punkt ergibt sich kein Bogen.`).

### Weiter

Setzt **tangential** an dem an, was zuletzt mit [LINIE](#befehl-linie),
[PLINIE](#befehl-plinie) oder BOGEN gezeichnet wurde: Der Bogen beginnt an dessen Endpunkt
(dort, wo er jetzt liegt) und verlässt ihn in der Richtung, in der die Linie, das letzte
Segment der Polylinie oder der Bogen dort ankommt. Start mit **Enter** ohne Eingabe beim
Startpunkt (bei jeder Methode) oder mit **Weiter** im Menü **▾**.

1. **`Endpunkt für Bogen angeben (Strg wechselt die Richtung):`** – das Ende des Bogens,
   gemessen ab dem Startpunkt; mehr braucht es nicht. Eine **Vorschau** zeigt den Bogen, dazu
   ein Gummiband vom Startpunkt.

- **Strg** (allein gedrückt) lässt den Bogen den Startpunkt in der Gegenrichtung verlassen
  (der Rest desselben Kreises).
- Ein Punkt genau in der Richtung oder Gegenrichtung (das wäre eine Gerade) oder auf dem
  Startpunkt wird nicht genommen (`Mit diesem Punkt ergibt sich kein Bogen.`).
- Gibt es nichts zum Fortsetzen (noch keine Linie, Polylinie und kein Bogen gezeichnet, oder
  das zuletzt Gezeichnete wurde per Rückgängig entfernt), meldet die Kommandozeile `Keine Linie
  oder kein Bogen zum Fortsetzen.` und die Abfrage des Startpunkts bleibt. Kreise, Ellipsen und
  Rechtecke zählen nicht: Nach ihnen setzt Weiter an der Linie, der Polylinie oder dem Bogen
  davor an.
- Jeder gezeichnete Bogen ist danach selbst das „zuletzt Gezeichnete“: **Enter, Enter** bei
  `Befehl:` (BOGEN wiederholen, dann fortsetzen) hängt Bogen an Bogen.

### Für alle Methoden

- Ein Klick auf eine andere Methode im Menü, während BOGEN läuft, bricht ab und startet den
  Befehl mit ihr neu; dieselbe Methode bewirkt nichts (auch wenn eine Option zu ihr gewechselt
  hat).
- Enter ohne Eingabe meldet nach dem Startpunkt bei den Punkt-Abfragen `Punkt oder
  Option-Schlüsselwort erforderlich.`
- **Esc** bricht bei jeder Abfrage ab (`*Abbruch*`), ohne Bogen.
- **Enter** bei `Befehl:` wiederholt BOGEN, wie getippt (also mit 3 Punkten als Vorgabe), auch
  nach einem Start über das Menü.
- Der Bogen hat eigene Punkte (Zentrum, Start, Ende), noch keinen Layer und den Standardstil,
  und ist **ein** Schritt für Rückgängig (`Rückgängig: BOGEN`). Er lässt sich danach wie jeder
  Bogen wählen, fangen und an seinen [Grips](#grips) bearbeiten.

Im Englischen heißen die Aufforderungen `Specify start point of arc or [Center]:` (nach dem
Mittelpunkt ohne Option), `Specify second point of arc or [Center/End]:`, `Specify end point of
arc:`, `Specify center point of arc:`, `Specify end point of arc (Ctrl switches direction) or
[Angle/chord Length]:`, `Specify included angle (Ctrl switches direction):`, `Specify length
of chord (Ctrl switches direction):`, `Specify center point of arc (Ctrl switches direction) or
[Angle/Direction/Radius]:`, `Specify tangent direction for the start point of arc (Ctrl
switches direction):` und `Specify radius of arc (Ctrl switches direction):`, die Optionen
`Center` (`C`), `End` (`E`), `Angle` (`A`), `chord Length` (`L`), `Direction` (`D`) und
`Radius` (`R`), der Button **Arc** mit **3-Point**, **Start, Center, End / Angle / Length**,
**Start, End, Angle / Direction / Radius**, **Center, Start, End / Angle / Length** und
**Continue** (`Specify end point of arc (Ctrl switches direction):`).

## Befehl ELLIPSE

Zeichnet eine **Ellipse**, wie AutoCAD ELLIPSE; danach endet der Befehl. Start mit dem Button
**Ellipse** in der Werkzeugleiste (bzw. einer Methode in seinem Menü **▾**) oder durch Tippen
von `ELLIPSE` oder `EL` bei `Befehl:`. Eine bestehende Auswahl wird dabei aufgehoben. Im Menü
fragt **Achse, Ende** wie getippt, **Mittelpunkt** gleich nach dem Mittelpunkt (wie nach der
Option `Mittelpunkt`); der Button zeigt anfangs **Mittelpunkt**, wie in AutoCAD.

1. **`Achsenendpunkt der Ellipse angeben oder [Mittelpunkt]:`** – ein Ende der ersten Achse.
2. **`Anderen Endpunkt der Achse angeben:`** – ab dem ersten Ende, also mit Polarspur, Ortho,
   `@`, Direkter Distanzeingabe und der Bemaßung der dynamischen Eingabe, dazu ein
   gestricheltes Gummiband. Die erste Achse legt Mittelpunkt, Länge und Winkel fest; sie darf
   die längere oder die kürzere Achse sein.
3. **`Abstand zur anderen Achse angeben oder [Drehung]:`** – die halbe Länge der anderen Achse, eine Abfrage
   eines Abstands ab dem **Mittelpunkt** wie der Radius bei [KREIS](#befehl-kreis): eine Zahl,
   oder der Abstand eines geklickten oder getippten Punkts vom Mittelpunkt. Eine Vorschau zeigt
   die Ellipse, dazu das Gummiband vom Mittelpunkt zum Cursor.

`M` (Mittelpunkt) + Enter beim ersten Punkt fragt stattdessen **`Mittelpunkt der Ellipse
angeben:`** und dann **`Endpunkt der Achse angeben:`** (ab dem Mittelpunkt; der Abstand ist die
halbe erste Achse), danach weiter mit Schritt 3.

`D` (Drehung) + Enter bei Schritt 3 fragt stattdessen **`Drehung um Hauptachse angeben:`**:
Die Ellipse ist dann ein Kreis auf der ersten Achse, um diese Achse aus der Zeichenebene
gedreht; die andere Halbachse ist die erste mal dem Cosinus des Winkels (0° gibt einen Kreis,
60° die halbe Breite). Eine Abfrage eines Winkels ab dem Mittelpunkt: eine getippte Zahl in
Grad, oder die Richtung vom Mittelpunkt zu einem Punkt (ab der X-Achse), mit Vorschau,
Gummiband und dem Winkelfeld der dynamischen Eingabe. Näher als `MAX_TURN_DEGREES`
(`src/cad/editor/tools/EllipseTool.ts`) an 90° wäre die Ellipse zu flach: `Drehung zu nahe an
90°: höchstens 89.4° sind möglich.`, die Abfrage bleibt. Das Vorzeichen und volle Drehungen
spielen keine Rolle.

- Ein zweites Achsenende auf dem ersten (bzw. ein Achsenende auf dem Mittelpunkt) wird
  ignoriert; nur ein **positiver** Abstand zur anderen Achse wird genommen, wie bei KREIS.
- **Esc** bricht bei jeder Abfrage ab, ohne Ellipse.
- Die Ellipse hat einen eigenen Mittelpunkt, noch keinen Layer und den Standardstil, und ist
  **ein** Schritt für Rückgängig (`Rückgängig: ELLIPSE`). Gedrehte Ellipsen fangen (Zentrum,
  Quadranten, Schnittpunkte) und zeigen Griffe an ihren gedrehten Achsenenden.

Im Englischen: `Specify axis endpoint of ellipse or [Center]:` (Option `Center`, `C`),
`Specify other endpoint of axis:`, `Specify center of ellipse:`, `Specify endpoint of axis:`,
`Specify distance to other axis or [Rotation]:` (Option `Rotation`, `R`) und `Specify rotation
around major axis:`.

## Befehl RECHTECK

Zeichnet ein **Rechteck** als geschlossene Polylinie mit vier Eckpunkten, wie AutoCAD RECHTECK;
danach endet der Befehl. Start mit dem Button **Rechteck** in der Werkzeugleiste oder durch
Tippen von `RECHTECK`, `REC` oder `RECTANG` bei `Befehl:`. Eine bestehende Auswahl wird dabei
aufgehoben.

1. **`Ersten Eckpunkt angeben oder [Fasen]:`** – eine Ecke, mit Objektfang, Objektfangspuren und
   Koordinateneingabe wie der erste Punkt von [LINIE](#befehl-linie).
2. **`Anderen Eckpunkt angeben oder [Abmessungen/Drehung]:`** – die diagonal gegenüberliegende Ecke,
   ab dem ersten Eckpunkt, also mit Polarspur, Ortho, `@` (z. B. `@1000,500`), Direkter
   Distanzeingabe (die Diagonale in Richtung Cursor) und der Bemaßung der dynamischen Eingabe
   (`,` wechselt dort zu X/Y). Eine **Vorschau** zeigt das Rechteck, das ein Klick ergäbe. Der
   Klick erzeugt es; die Seiten liegen parallel zu X und Y, solange keine
   [Drehung](#drehung-und-fasen) gilt.

`A` (Abmessungen) + Enter beim anderen Eckpunkt fragt **`Länge der Rechtecke angeben:`** (die
Seite in X-Richtung) und **`Breite der Rechtecke angeben:`** (in Y-Richtung). Beides sind
Abfragen eines Abstands ab dem ersten Eckpunkt wie der Radius bei [KREIS](#befehl-kreis): eine
getippte **Zahl**, oder der Abstand eines geklickten oder getippten Punkts vom ersten Eckpunkt,
dazu ein gestricheltes Gummiband. Danach kommt wieder `Anderen Eckpunkt angeben oder
[Abmessungen/Drehung]:`: die Vorschau zeigt das Rechteck mit dieser Länge und Breite in dem Quadranten um
den ersten Eckpunkt, in dem der Cursor liegt, und ein Klick (oder getippter Punkt) wählt nur
diesen Quadranten (auf einer Achse gilt die positive Seite). `A` fragt dort erneut nach den
Abmessungen.

- Ein anderer Eckpunkt mit gleichem X oder Y wie der erste ergibt keine Fläche und wird
  ignoriert; die Abfrage bleibt. Nur eine **positive** Länge oder Breite wird genommen (sonst
  `Wert muss positiv und ungleich Null sein.`).
- **Vorgabe:** Länge und Breite merkt sich der Befehl, sobald sie einmal angegeben wurden:
  Die Aufforderungen heißen dann z. B. `Länge der Rechtecke angeben <300.0000>:` und `Breite
  der Rechtecke angeben <200.0000>:`, und **Enter** ohne Eingabe übernimmt den Wert. Vorher
  meldet Enter `Erfordert numerischen Abstand oder zweiten Punkt.`. Wie bei
  [KREIS](#befehl-kreis) gilt die Vorgabe bis zum Neuladen der Seite.
- Enter ohne Eingabe beim anderen Eckpunkt meldet `Punkt oder Option-Schlüsselwort erforderlich.`
- **Esc** bricht bei jeder Abfrage ab (`*Abbruch*`), ohne Rechteck.
- Das Rechteck hat eigene Eckpunkte, noch keinen Layer und den Standardstil, und ist **ein**
  Schritt für Rückgängig (`Rückgängig: RECHTECK`).

### Drehung und Fasen

Zwei Einstellungen gelten, einmal gesetzt, **auch für die folgenden Rechtecke**, bis sie
geändert werden (und bis zum Neuladen der Seite), wie in AutoCAD. Gilt eine, nennt der Befehl
sie beim Start, z. B. `Aktuelle Rechteckmodi: Fasen=30.0000 x 20.0000  Drehung=45`.

- **Drehung**: `D` + Enter beim anderen Eckpunkt fragt **`Drehwinkel angeben <0>:`**, einen
  Winkel ab dem ersten Eckpunkt: eine getippte Zahl in Grad (gegen den Uhrzeigersinn), oder die
  Richtung vom ersten Eckpunkt zu einem Punkt; **Enter** behält den Wert in den spitzen
  Klammern. Danach kommt wieder der andere Eckpunkt: Die Seiten liegen jetzt entlang des
  Winkels, der andere Eckpunkt bleibt die gegenüberliegende Ecke. Länge und Breite der
  `Abmessungen` und der Quadrant zählen ebenfalls entlang der gedrehten Seiten. `0` stellt die
  Drehung ab.
- **Fasen**: `F` + Enter beim ersten Eckpunkt fragt **`Ersten Fasenabstand für Rechtecke
  angeben <0.0000>:`** und **`Zweiten Fasenabstand für Rechtecke angeben <…>:`** (Vorgabe ist
  der erste Abstand). Jeder ist eine Zahl oder der Abstand zweier Punkte (nach dem ersten
  fragt `Zweiten Punkt angeben:`); **Enter** übernimmt den Wert in den Klammern. Danach kommt
  wieder der erste Eckpunkt. Das Rechteck hat dann acht Eckpunkte: Jede Ecke ist schräg
  abgeschnitten, um den ersten Abstand auf der Seite, die (vom ersten Eckpunkt aus reihum) an
  der Ecke ankommt, und um den zweiten auf der Seite, die von ihr weggeht. Passen die Abstände
  nicht auf eine Seite (ihre Summe ist länger), wird das Rechteck ohne Fasen gezeichnet. Ein
  Abstand von `0` stellt die Fasen ab; ein negativer meldet `Wert darf nicht negativ sein.`
  Die dynamische Eingabe zeigt bei den Fasenabständen kein Feld (sie haben keinen Punkt, von
  dem sie messen).

Im Englischen: `Specify first corner point or [Chamfer]:`, `Specify other corner point or
[Dimensions/Rotation]:` (Optionen `Chamfer` `C`, `Dimensions` `D`, `Rotation` `R`), `Specify
length for rectangles:`, `Specify width for rectangles:`, `Specify rotation angle <0>:`,
`Specify first chamfer distance for rectangles <0.0000>:`, `Specify second chamfer distance for
rectangles <…>:`, `Specify second point:` und `Current rectangle modes: Chamfer=… x …
Rotation=…`.

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

Beim zweiten Punkt von SCHIEBEN, beim nächsten Punkt von LINIE und PLINIE und bei den Punkten
und Abständen von KREIS, ELLIPSE und RECHTECK, die ab einem Punkt gemessen werden, zeigt die
Polarspur, wenn der Cursor nahe an einer Richtung unter einem Polarwinkel ab dem Basispunkt (bei
LINIE und PLINIE: ab dem letzten Punkt, bei KREIS, ELLIPSE und RECHTECK: ab dem Bezugspunkt) liegt (bei einem Winkelschritt von 90°
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

Beim zweiten Punkt von SCHIEBEN und beim nächsten Punkt von LINIE und PLINIE (ebenso bei den ab
einem Punkt gemessenen Abfragen von KREIS, ELLIPSE und RECHTECK) liegt der Punkt
mit Ortho immer auf der Waagrechten oder der Senkrechten durch den Basispunkt (bei LINIE und
PLINIE: den letzten Punkt, bei KREIS, ELLIPSE und RECHTECK: den Bezugspunkt), je nachdem, welche dem Cursor näher liegt. Anders
als bei der Polarspur gilt das ohne Toleranz, egal wie weit der Cursor daneben liegt.

| Eingabe                       | Wirkung                                                  |
|-------------------------------|----------------------------------------------------------|
| **F8** oder Button **ORTHO**  | Schaltet Ortho ein oder aus                              |
| **Shift** gedrückt halten     | Schaltet Ortho vorübergehend um: ist es aus, gilt es, solange Shift gedrückt ist; ist es an, ist es solange aus |

- Ortho und Polarspur schließen sich aus: Ortho ein schaltet POLAR aus, POLAR ein (auch
  über die Winkelwahl im Menü) schaltet Ortho aus. Die Polarwinkel bleiben erhalten.
- **Shift** wirkt wie AutoCADs temporäre Überschreibung: sofort beim Drücken und Loslassen,
  auch ohne die Maus zu bewegen, und auch für einen Klick mit gedrückter Shift-Taste. Die
  Einstellung und der Schalter **ORTHO** in der Statuszeile ändern sich dabei nicht. Solange
  Ortho per Shift gilt, ruht die Polarspur.
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
  Verschiebung), LINIE, PLINIE, KREIS, ELLIPSE und RECHTECK, auch ohne Basispunkt.
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

## Dynamische Eingabe (DYN)

Die dynamische Eingabe bringt Aufforderung und Eingabe an das Fadenkreuz, damit der Blick nicht
zur Kommandozeile wandern muss. Die Kommandozeile zeigt weiterhin alles mit.

| Eingabe                       | Wirkung                                                  |
|-------------------------------|----------------------------------------------------------|
| **F12** oder Button **DYN**   | Schaltet die dynamische Eingabe ein oder aus             |
| Button **▾** neben DYN        | Menü mit **Zeigereingabe**, **Bemaßungseingabe** und **Dynamische Eingabeaufforderungen** zum An- und Abwählen |
| Ziffern, `.`, `-`, `#`, `@`   | Tippen ins hervorgehobene Feld                           |
| `,` bzw. `<` im ersten Feld   | Wechselt ins zweite Feld: `,` für X/Y, `<` für Abstand und Winkel |
| **Tab** / **Shift+Tab**       | Wechselt zwischen den Feldern, sobald etwas getippt ist (vorher schaltet Tab wie gewohnt die Fangpunkte durch) |
| **Enter** (oder **Leertaste**, sobald etwas getippt ist) | Nimmt den Punkt                 |
| **Backspace**                 | Löscht im Feld; im leeren zweiten Feld zurück ins erste  |
| **Esc**                       | Verwirft das Getippte, ein zweites Esc bricht den Befehl ab |

Ob F12 im Browser stattdessen die Entwicklertools öffnet, hängt vom Browser ab; der Button
**DYN** wirkt immer.

- **Zeigereingabe**: Beim Basispunkt (und bei `Verschiebung angeben`) stehen oben rechts neben
  dem Fadenkreuz zwei Felder mit **X** und **Y** des Punkts, den ein Klick nähme (Fangpunkt,
  Spur oder Cursor), absolut; mit `@` vorne relativ zum zuletzt angegebenen Punkt. Beim
  zweiten Punkt zeigen sie ohne Bemaßungseingabe **Abstand** und **Winkel** vom Basispunkt.
- **Bemaßungseingabe**: Beim zweiten Punkt zeigt eine temporäre Bemaßung Abstand und Winkel:
  eine Maßlinie parallel zur Strecke Basispunkt–Punkt mit Architekturstrichen, das
  Abstandsfeld darauf, und ein gestrichelter Bogen ab der Waagrechten mit dem Winkelfeld
  außerhalb der Bogenmitte, also auf der anderen Seite der Linie als das Abstandsfeld. Ist der
  Winkel kleiner als `ANGLE_LABEL_MIN_DEGREES` (`src/ui/DynamicInputLayer.ts`), passt das Feld
  nicht zwischen Waagrechte und Linie und steht unter der Waagrechten.
  Winkel in Grad gegen den Uhrzeigersinn ab der positiven X-Achse (0–360°).
- **Ein Feld allein**: Fragt ein Befehl nur nach einem **Abstand** (z. B. der Radius bei
  [KREIS](#befehl-kreis)) oder nur nach einem **Winkel** (der Drehwinkel der [Grips](#grips),
  der eingeschlossene Winkel und die Richtung bei [BOGEN](#befehl-bogen)), zeigt die
  Bemaßungseingabe nur dieses Feld: die Maßlinie mit dem Abstand bzw. den Bogen ab der
  Waagrechten mit dem Winkel, jeweils ab dem Punkt, von dem der Befehl misst. Ohne
  Bemaßungseingabe steht das Feld neben dem Fadenkreuz. `,` und `<` wechseln dort nicht das
  Feld, sondern bleiben im Text; so lässt sich weiter ein Punkt tippen (`@100<90`). Die
  getippte Zahl gilt, wie sie ist, auch **negativ** (ein Winkel im Uhrzeigersinn, die längere
  Sehne …): Vorschau, Enter und Klick nehmen sie mit ihrem Vorzeichen, und der Bogen des
  Winkelfelds läuft dann im Uhrzeigersinn. Hat die Abfrage keinen Punkt, von dem sie misst
  (Bezugswinkel und Bezugslänge der Grips), gibt es kein Feld.
- **Dynamische Eingabeaufforderungen**: Die aktuelle Aufforderung steht über den Feldern
  neben dem Fadenkreuz, auch bei `Objekte wählen:`; bei `Befehl:` der getippte Befehlsname.
  Ohne Befehl und ohne Getipptes erscheint nichts.
- Leere Felder zeigen die **Live-Werte** in Grau und folgen dem Cursor. Das Feld, in das
  getippt wird, ist blau umrandet und hat einen Textcursor; ein getipptes Feld, das man mit
  Tab verlassen hat, zeigt ein **Schloss**. Springt Tab zurück in ein getipptes Feld, ersetzt
  das erste Zeichen dessen Wert.
- **Getippte Werte binden sofort**: Vorschau, Gummiband und ein Klick folgen ihnen, der
  gebundene Punkt hat ein kleines **x**. Ist nur der Abstand getippt, bestimmt der Cursor die
  Richtung (z. B. `500`, **Tab**, Maus in die gewünschte Richtung, Klick); ist nur der Winkel
  getippt (z. B. `<30`), liegt der Punkt auf diesem Strahl, so weit vom Basispunkt entfernt wie
  der Cursor; die Linie zeigt also immer in die getippte Richtung, und die Länge ändert sich
  nur, wenn der Cursor näher heran oder weiter weg geht.
  Bei X/Y kommt der nicht getippte Wert vom Cursor.
- Beim zweiten Punkt ist die Eingabe **relativ zum Basispunkt**: `500<90` sind 500 mm nach
  oben, `100,50` 100 mm nach rechts und 50 mm nach oben, ohne `@`. **`#`** vorne macht sie
  absolut (`#200,300`, `#1000<45`).
- **Nur ein Abstand** + Enter wirkt wie die Direkte Distanzeingabe: entlang der
  [Polarspur](#polarspur-polar), mit [Ortho](#ortho-ortho) waagrecht bzw. senkrecht, auf einer
  einzelnen [Objektfangspur](#objektfangspuren-otrack) vom erfassten Punkt aus.
- Text, der keine Zahl ist, gilt wie in der Kommandozeile: `V` wählt beim Basispunkt die
  Option **Verschiebung**, sonst meldet die Kommandozeile `Punkt oder
  Option-Schlüsselwort erforderlich.`
- Die Felder zeigen Längen mit `DYN_LENGTH_DECIMALS` und Winkel mit höchstens
  `DYN_ANGLE_DECIMALS` Nachkommastellen (`src/cad/editor/dynamicInput.ts`). Abstände und
  Größen der Anzeige (`DYN_OFFSET_PX`, `DIMENSION_OFFSET_PX`, `ANGLE_ARC_MAX_RADIUS_PX`,
  `ANGLE_LABEL_GAP_PX`, `TICK_SIZE_PX` …) stehen in `src/ui/DynamicInputLayer.ts`. Am Rand der Zeichenfläche kippt
  das Feld auf die andere Seite des Fadenkreuzes.
- Ist DYN aus, oder zeigt die Aufforderung keine Felder (Basispunkt ohne Zeigereingabe), geht
  das Getippte wie bisher in die Kommandozeile. Umschalten während des Tippens verwirft das
  Getippte.

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
| `snapMagnet`       | Fadenkreuz springt auf den Fangpunkt (und auf Polar- und Objektfangspuren sowie auf Grips) | AUTOSNAP |
| `snapPreview`      | Fangpunkt-Vorschau der Objekte unter dem Fangbereich           | (keine)      |
| `previewColor`     | Farbe von Fangpunkt-Vorschau und Gummiband, bei Hell / Dunkel  |              |
| `gripSize`         | Kantenlänge eines Grips in px; mit der Pickbox zusammen sein Trefferbereich | GRIPSIZE |
| `gripColor`        | Farben der Grips (`warm`, `hover`, `hot`), bei Hell / Dunkel   | GRIPCOLOR, GRIPHOVER, GRIPHOT |
| `gripMenu`         | Menü mit den Aktionen eines Grips beim Verweilen anzeigen       | GRIPMULTIFUNCTIONAL |
| `gripMenuDelay`    | Verweildauer in ms, bis das Grip-Menü erscheint                 | (keine)      |
| `gripObjectLimit`  | Größte Zahl gewählter Objekte, für die Grips gezeigt werden; 0 = unbegrenzt | GRIPOBJLIMIT |
| `polarTolerance`   | Größter Abstand des Cursors von einer Polar- oder Objektfangspur in px |      |
| `trackingAcquireDelay` | Verweildauer in ms, bis ein Fangpunkt für die Objektfangspuren erfasst (bzw. wieder entfernt) wird | (keine) |
| `gridMinSpacing`   | Kleinster Abstand der Rasterlinien in px; enger wird das Raster gröber |      |
| `gridColor`        | Farben der Neben- und Hauptlinien des Rasters, bei Hell / Dunkel | Optionen → Farben |
| `ucsIcon`          | BKS-Symbol anzeigen                                            | UCSICON Ein/Aus |
| `ucsIconAtOrigin`  | BKS-Symbol am Nullpunkt, solange es dort passt; aus = immer unten links | UCSICON Ursprung / Kein Ursprung |
| `ucsIconSize`      | Länge der Achsen des BKS-Symbols in px                         | UCSICON Eigenschaften |
| `ucsIconLabelSize` | Schriftgröße der Achsenbeschriftung „X“/„Y“ in px              | UCSICON Eigenschaften |
| `ucsIconOpacity`   | Deckkraft des BKS-Symbols (0–1), damit es sich von gezeichneten Linien abhebt |  |

Was in der Statuszeile und ihren Menüs geändert wird (OFANG, Fangmodi, POLAR mit
Winkelschritt und Zusatzwinkeln, ORTHO, OTRACK, RASTER mit Abstand und Hauptlinien, DYN mit
seinen Teilen), merkt sich der Browser und gilt nach dem Neuladen wieder (`localStorage`,
`src/settings/storedSwitches.ts`; ein gespeicherter Wert, der nicht mehr gültig ist, fällt auf
seinen Startwert zurück). Die Startwerte, solange nichts gespeichert ist:

- `DEFAULT_SNAP_SETTINGS`: OFANG `enabled` und die Fangmodi `modes` (OSMODE).
- `DEFAULT_TRACKING_MODES`: ORTHO `ortho` und die Polarspur `polar` mit `enabled`,
  `incrementAngle` (POLARANG) und `additionalAngles` (POLARADDANG).
- `POLAR_INCREMENTS`: die Winkelschritte im POLAR-Menü.
- `DEFAULT_OBJECT_TRACKING_SETTINGS`: OTRACK `enabled` (F11) und `allPolarAngles` (Mit
  allen Polarwinkeln spuren statt nur orthogonal).
- `DEFAULT_GRID_SETTINGS`: RASTER `enabled` (GRIDMODE), `spacing` (GRIDUNIT),
  `majorEvery` (GRIDMAJOR).
- `DEFAULT_DYNAMIC_INPUT_SETTINGS`: DYN `enabled` (F12), `pointerInput` und
  `dimensionInput` (die Bits von DYNMODE), `prompts` (DYNPROMPT).

## Noch nicht umgesetzt

- Weitere temporäre Überschreibungstasten wie in AutoCAD (z. B. Shift+A für den Objektfang,
  Shift+X für die Polarspur, Shift+E nur Endpunkt); die Liste der geplanten Kürzel steht in
  `docs/todo/Zeichnen_Tastenkuerzel.md`.
- Kontextmenüs mit der rechten Maustaste und eine Einstellung dafür wie AutoCADs
  Rechtsklick-Anpassung (wie Enter, Kontextmenü, zeitabhängiger Rechtsklick: kurz = Enter,
  lang = Menü).
- Bei LINIE: aktueller Layer und Stil für neue Objekte, gemeinsame Punkte (echte Verbindungen) zwischen
  den Segmenten, englische Optionen mit `_` im deutschen Editor.
- Bei PLINIE: Bogensegmente (Option `Kreisbogen` mit ihren Unteroptionen, danach `sehnenLänge`
  tangential zum Bogen), Breite und Halbbreite, die Meldung zur aktuellen Linienbreite, Fangen an den
  eigenen Segmenten während des Befehls, aktueller Layer und Stil; Details in
  `docs/todo/Polyline_Draw_NotImplemented.md`.
- Bei KREIS: die Optionen `Ttr` (Tangente, Tangente, Radius) und „Tan, Tan, Tan“ (brauchen den
  Tangenten-Fang), aktueller Layer und Stil.
- Bei ELLIPSE: die Option `Bogen` (elliptischer
  Bogen mit Start- und Endwinkel), aktueller Layer und Stil; Details in
  `docs/todo/Circle_Ellipse_Draw_NotImplemented.md`.
- Bei RECHTECK: die Optionen `Abrunden`, `Breite`, `Erhebung` und `Objekthöhe` beim
  ersten Eckpunkt, `Fläche` beim anderen, `Punkte auswählen` beim Drehwinkel, die
  Bemaßung beider Seiten in der dynamischen Eingabe, aktueller Layer und Stil; Details in
  `docs/todo/Rectangle_Draw_NotImplemented.md`.
- Bei BOGEN: aktueller Layer und Stil; Details in
  `docs/todo/Arc_Draw_NotImplemented.md`.
- Bei den Grips: Kopieren mit
  gedrückter Strg-Taste und Versatzfang mit Shift, im Grip-Menü „In Bogen umwandeln“ und die
  Längenangaben der dynamischen Eingabe; Details in `docs/todo/Grips_NotImplemented.md`.
- Alle anderen Bearbeitungsbefehle wie Löschen, Gruppieren oder Kopieren.
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
- Bei der dynamischen Eingabe: Optionen-Menü mit der Pfeiltaste ↓, Einstellungen für Format
  und Koordinaten der Zeigereingabe (polar/kartesisch, relativ/absolut, immer anzeigen) und das
  Aussehen der Felder, mehrere Bemaßungen (z. B. beim Ziehen an Grips), rote Markierung
  ungültiger Felder, Einheiten und Genauigkeit, Vervollständigung von Befehlsnamen,
  Eingabe-Historie mit den Pfeiltasten, Koordinaten am Cursor ohne Befehl.
- Die Schalter der Statuszeile und die zuletzt verwendeten Methoden merkt sich nur dieser
  Browser, nicht das Konto oder der Plan; die Vorgabewerte der Befehle (Kreisradius,
  Rechteckmaße, Drehung, Fasen) gelten weiter nur bis zum Neuladen.
- Beim BKS-Symbol: eigenes BKS (Befehl BKS, Ursprung verschieben, Drehen) samt Wirkung auf
  Koordinateneingabe, Ortho, Polarspur und Raster; Symbol wählen, Griffe und Kontextmenü;
  Befehl BKSYMBOL zum Umschalten; 3D-Darstellung. Die Größe ist fest in px und wächst nicht
  mit der Zeichenfläche.
- Die Einstellungen im Editor ändern.
