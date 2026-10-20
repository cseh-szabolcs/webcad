# Bedienung des CAD-Editors

Alle Maus- und Tastaturbefehle des Editors (`depts/editor/`). Auf dem Mac entspricht
**Cmd** der Taste Ctrl unter Windows/Linux, **Option** der Taste Alt.

Tastenkürzel wirken, solange der Fokus nicht in einem Textfeld liegt.

## Ansicht

| Eingabe                         | Wirkung                                                  |
|---------------------------------|----------------------------------------------------------|
| Mausrad / Trackpad scrollen     | Zoomt um den Mauszeiger                                  |
| Mittlere Maustaste ziehen       | Verschiebt die Ansicht (Pan)                             |
| Leertaste halten + links ziehen | Verschiebt die Ansicht (Pan)                             |
| Button **Fit**                  | Zeigt den ganzen Plan                                    |

Die Toolbar zeigt rechts den Bildschirmmaßstab (z. B. `1:50`, bezogen auf 96 dpi).

## Auswählen

| Eingabe                    | Wirkung                                                                 |
|----------------------------|-------------------------------------------------------------------------|
| Klick auf ein Element      | Wählt das Element aus, bei gruppierten Elementen die ganze Gruppe        |
| Alt + Klick                | Wählt nur das angeklickte Element, auch wenn es in einer Gruppe ist      |
| Shift + Klick              | Fügt das Element (bzw. seine Gruppe) zur Auswahl hinzu oder entfernt es |
| Alt + Shift + Klick        | Fügt nur dieses eine Element hinzu oder entfernt es                     |
| Klick in einer Mehrfachauswahl (ohne Ziehen) | Reduziert die Auswahl auf das angeklickte Element bzw. seine Gruppe |
| Klick ins Leere            | Hebt die Auswahl auf (mit Shift bleibt sie bestehen)                    |
| Esc                        | Hebt die Auswahl auf                                                    |

Beim Überfahren mit der Maus wird hervorgehoben, was ein Klick auswählen würde: die ganze
Gruppe, mit gehaltener Alt-Taste nur das Element. Elemente auf ausgeblendeten oder
gesperrten Layern lassen sich nicht auswählen.

## Verschieben und Bearbeiten

| Eingabe                                  | Wirkung                                                         |
|------------------------------------------|-----------------------------------------------------------------|
| Ausgewähltes Element ziehen              | Verschiebt die ganze Auswahl                                    |
| Nicht ausgewähltes Element ziehen        | Wählt es (bzw. seine Gruppe) aus und verschiebt es              |
| Alt + Element ziehen                     | Wählt nur dieses Element aus und verschiebt es                  |
| Vertex-Handle ziehen (weißes Quadrat)    | Verschiebt diesen Punkt                                         |
| Seiten-Handle einer Ellipse ziehen       | Ändert diesen Radius, der Mittelpunkt bleibt fest              |
| Shift beim Ziehen eines Ellipsen-Handles | Ändert beide Radien im selben Verhältnis                        |
| Esc während des Ziehens                  | Bricht das Ziehen ab, nichts wird geändert                      |

Ein Ziehen beginnt erst nach 3 Pixeln Bewegung, ein kurzes Zucken bleibt ein Klick. Handles
haben Vorrang vor Elementen, wenn beide unter dem Mauszeiger liegen.

Punkte, die mehrere Elemente gemeinsam benutzen, bewegen sich für alle diese Elemente mit.
Verschiebt man nur einen Teil solcher Elemente, verformen sich die anderen (z. B. wird der
Türbogen größer, wenn man nur das Türblatt zieht).

Jedes Ziehen ist beim Loslassen ein einziger Undo-Schritt.

## Fangen (Snap)

| Eingabe             | Wirkung                                                 |
|---------------------|---------------------------------------------------------|
| F3, Button **Snap** | Schaltet das Fangen ein oder aus (beim Laden ist es an) |

Ist das Fangen an, rastet ein gezogener Vertex-Handle auf den nächsten Fangpunkt ein, sobald
er weniger als 10 Pixel davon entfernt ist. Ein Quadrat zeigt den Fangpunkt an:

| Farbe | Fangpunkt                                                                     |
|-------|-------------------------------------------------------------------------------|
| Grün  | Echter Punkt: Linien- und Bogenenden, Polylinien-Ecken, Mittelpunkt von Ellipse und Bogen |
| Lila  | Berechneter Punkt: Mitte einer Linie, Mitte jedes Polylinien-Segments, Mitte eines Bogens, die vier Außenpunkte (Quadranten) einer Ellipse |

Berechnete Punkte werden nicht gespeichert, sie ergeben sich aus dem Element. Liegen ein
echter und ein berechneter Punkt gleich weit entfernt, gewinnt der echte. Auf Punkte des
Elements, das man gerade verändert, wird nicht gefangen (z. B. nicht auf die Mitte der
Linie, deren Ende man zieht). Punkte auf ausgeblendeten oder gesperrten Layern werden
ebenfalls nicht gefangen.

Fangen setzt nur die Position, wie in AutoCAD: Die Elemente werden **nicht** verbunden.
Verschiebt man danach eines davon, bleibt das andere liegen.

Im Moment gilt das Fangen nur beim Ziehen eines Vertex-Handles, nicht beim Verschieben
ganzer Elemente.

## Löschen, Gruppieren, Rückgängig

| Eingabe                                     | Wirkung                                                        |
|---------------------------------------------|----------------------------------------------------------------|
| Entf / Backspace, Button **Delete**         | Löscht die ausgewählten Elemente                               |
| Cmd/Ctrl + G, Button **Group**              | Gruppiert die Auswahl (mindestens zwei Elemente)               |
| Cmd/Ctrl + Shift + G, Button **Ungroup**    | Löst alle Gruppen der ausgewählten Elemente auf                |
| Cmd/Ctrl + Z, Button **Undo**               | Macht den letzten Schritt rückgängig                           |
| Cmd/Ctrl + Shift + Z, Ctrl + Y, Button **Redo** | Stellt den rückgängig gemachten Schritt wieder her         |

- **Löschen** entfernt auch Punkte, die kein anderes Element mehr benutzt, und Gruppen ohne
  Mitglieder.
- **Gruppieren** einer Auswahl, die schon Gruppen enthält, führt diese zu einer neuen
  Gruppe zusammen. Neue Gruppen heißen „Group 1“, „Group 2“ usw.
- **Auflösen** gibt alle Mitglieder einer Gruppe frei, auch wenn nur eines ausgewählt war.
  Die Elemente bleiben danach ausgewählt.
- Die Buttons sind nur aktiv, wenn der Befehl gerade möglich ist. Fährt man über Undo/Redo,
  zeigt der Tooltip, welcher Schritt rückgängig gemacht wird.

## Entwicklerhilfe

Im Dev-Modus schreibt der Editor bei jeder Änderung der Auswahl und nach jedem Befehl die
aktuelle Auswahl in die Browser-Konsole (`[cad] selection (n)`), mit Typ, Name und Gruppe
jedes Elements.
