# Bis jetzt erreicht

Zunächst sollten die Objekte beim Hover hervorgehoben werden.

Für die Objektauswahl gibt es zwei grundsätzliche Arbeitsweisen:

### Befehl zuerst starten (Verb-Noun)

- Der User klickt auf das fiktive Werkzeug "Auswahl" (was oben links als Werkzeug dargestellt werden soll).  Unten soll die Kommandozeile, welches bis jetzt nur der Darstellung dient "AUSWAHL Objekte wählen" anzeigen, dass wir im uns im Auswahlmodus befinden. Beim Klick auf die jeweiligen Objekte werden sie der Auswahl hinzugefügt.
- Die Auswahl wird mit Enter (oder Rechtsklick) abgeschlossen.  Ausgewählte Objekte sollten dann wieder farblich anders dargestellt werden.


### Objekte zuerst auswählen (Noun-Verb)

- Es ist kein Befehl aktiv.
- Die gewünschten Objekte werden durch Klick ausgewählt. Die Darstellung in diesen Auswahlmodus ist so, wie im editor-bak, wir zeige die Grips an und die Linien sind wiede hervorgehoben. Die Grips haben aber in diesen Schritt noch keine Funktion. 
- Anschließend wird der Auswahl-Befehl gestartet, wenn man oben auf den fiktiven Werkzeug "Auswahl" klickt, die - bereits getroffene Auswahl wird übernommen und die Darstellung ist dann wie im Punkt 1 dieser Liste.

### Methoden zum Aufbau der Auswahl

- Einzelklick: Auf ein Objekt klicken. Das Objekt wird der aktuellen Auswahl hinzugefügt.
- Fensterwahl (Window): Auswahlrechteck von links nach rechts aufziehen. Nur vollständig eingeschlossene Objekte werden ausgewählt.
- Kreuzenwahl (Crossing): Auswahlrechteck von rechts nach links aufziehen. Alle Objekte, die das Rechteck berührt oder schneidet, werden ausgewählt.
- Lasso: Maustaste gedrückt halten und frei ziehen. Je nach Richtung verhält sich die Auswahl wie Fenster- oder Kreuzenwahl. Mit der Leertaste kann zwischen den Modi gewechselt werden.

### Weitere Hinweise

- Mit Shift + Klick/Ziehen können Objekte aus der aktuellen Auswahl entfernt werden.
- Den Cursor können wir in diesen Schritt so lassen wie sie ist.
- Ich habe noch drei Screnshots mitgegeben, sie stammen von AutoCAD und dienen nur als Hilfe. Im 1. Bild ist nichts ausgewähl, im 2. Bild ist ein wurden zwei Kreise (links) der Auswahl hinzugefügt (Verb-Noun) und im 3. Bild ist zu sehen wie es aussieht, wenn eine Noun-Verb-Auswahl durch Klick auf jeweils die zwei Kreise (rechts) ausgewählt wurden mit sichtbaren Grips.


# Vollständige Liste (noch nicht alle umgesetzt)

Zwei grundsätzliche Arbeitsweisen

Befehl zuerst starten (Verb-Noun)
Ein Befehl wird gestartet, der eine Objektauswahl erwartet.
An der Aufforderung „Objekte wählen“ wird die Auswahl aufgebaut.
Die Auswahl wird mit Enter (oder Rechtsklick) abgeschlossen. Danach wird der Befehl fortgesetzt.
Objekte zuerst auswählen (Noun-Verb)
Es ist kein Befehl aktiv.
Die gewünschten Objekte werden ausgewählt.
Anschließend wird der gewünschte Befehl gestartet.
Die bereits getroffene Auswahl wird übernommen; ein zusätzliches Enter zum Abschluss der Auswahl ist nicht erforderlich.
Voraussetzung: Systemvariable PICKFIRST = 1 (Standardwert).

Methoden zum Aufbau der Auswahl

Einzelklick: Auf ein Objekt klicken. Das Objekt wird der aktuellen Auswahl hinzugefügt.
Fensterwahl (Window): Auswahlrechteck von links nach rechts aufziehen. Nur vollständig eingeschlossene Objekte werden ausgewählt.
Kreuzenwahl (Crossing): Auswahlrechteck von rechts nach links aufziehen. Alle Objekte, die das Rechteck berührt oder schneidet, werden ausgewählt.
Lasso: Maustaste gedrückt halten und frei ziehen. Je nach Richtung verhält sich die Auswahl wie Fenster- oder Kreuzenwahl. Mit der Leertaste kann zwischen den Modi gewechselt werden.
Zaun (Fence): An der Aufforderung „Objekte wählen“ F eingeben und eine Linie aufziehen. Alle Objekte, die die Linie kreuzt, werden ausgewählt.
Fensterpolygon (WP) / Kreuzenpolygon (CP): Mit WP bzw. CP ein Polygon aufziehen. Verhalten analog zur Fenster- bzw. Kreuzenwahl.
Alle (ALL): ALL eingeben. Alle Objekte im aktuellen Bereich werden ausgewählt (außer auf gesperrten oder gefrorenen Layern).
Letztes (Last): L eingeben. Das zuletzt erstellte sichtbare Objekt wird ausgewählt.
Vorherige Auswahl (Previous): P eingeben. Die zuletzt verwendete Auswahlmenge wird wieder aufgerufen.

Weitere Hinweise

An der Aufforderung „Objekte wählen“ können die Methoden durch Eingabe der Kürzel erzwungen werden (W, C, WP, CP, F usw.).
Mit Shift + Klick/Ziehen können Objekte aus der aktuellen Auswahl entfernt werden.
Mit den Befehlen QSELECT oder SELECTSIMILAR können Objekte nach Eigenschaften (Layer, Farbe, Typ usw.) gefiltert und ausgewählt werden.
Die Auswahl ist abgeschlossen, sobald Enter gedrückt wird (bei aktivem Befehl) bzw. sobald der nächste Befehl gestartet wird (bei vorheriger Auswahl).

#### Zwei grundsätzliche Arbeitsweisen

1. **Befehl zuerst starten (Verb-Noun)**  
   Ein Befehl wird gestartet, der eine Objektauswahl erwartet.  
   An der Aufforderung „Objekte wählen“ wird die Auswahl aufgebaut.  
   Die Auswahl wird mit Enter (oder Rechtsklick) abgeschlossen. Danach wird der Befehl fortgesetzt.

2. **Objekte zuerst auswählen (Noun-Verb)**  
   Es ist kein Befehl aktiv.  
   Die gewünschten Objekte werden ausgewählt.  
   Anschließend wird der gewünschte Befehl gestartet.  
   Die bereits getroffene Auswahl wird übernommen; ein zusätzliches Enter zum Abschluss der Auswahl ist nicht erforderlich.  
   Voraussetzung: Systemvariable `PICKFIRST` = 1 (Standardwert).

#### Methoden zum Aufbau der Auswahl

- **Einzelklick**: Auf ein Objekt klicken. Das Objekt wird der aktuellen Auswahl hinzugefügt.
- **Fensterwahl (Window)**: Auswahlrechteck von links nach rechts aufziehen. Nur vollständig eingeschlossene Objekte werden ausgewählt.
- **Kreuzenwahl (Crossing)**: Auswahlrechteck von rechts nach links aufziehen. Alle Objekte, die das Rechteck berührt oder schneidet, werden ausgewählt.
- **Lasso**: Maustaste gedrückt halten und frei ziehen. Je nach Richtung verhält sich die Auswahl wie Fenster- oder Kreuzenwahl. Mit der Leertaste kann zwischen den Modi gewechselt werden.
- **Zaun (Fence)**: An der Aufforderung „Objekte wählen“ `F` eingeben und eine Linie aufziehen. Alle Objekte, die die Linie kreuzt, werden ausgewählt.
- **Fensterpolygon (WP) / Kreuzenpolygon (CP)**: Mit `WP` bzw. `CP` ein Polygon aufziehen. Verhalten analog zur Fenster- bzw. Kreuzenwahl.
- **Alle (ALL)**: `ALL` eingeben. Alle Objekte im aktuellen Bereich werden ausgewählt (außer auf gesperrten oder gefrorenen Layern).
- **Letztes (Last)**: `L` eingeben. Das zuletzt erstellte sichtbare Objekt wird ausgewählt.
- **Vorherige Auswahl (Previous)**: `P` eingeben. Die zuletzt verwendete Auswahlmenge wird wieder aufgerufen.

#### Weitere Hinweise

- An der Aufforderung „Objekte wählen“ können die Methoden durch Eingabe der Kürzel erzwungen werden (`W`, `C`, `WP`, `CP`, `F` usw.).
- Mit Shift + Klick/Ziehen können Objekte aus der aktuellen Auswahl entfernt werden.
- Mit den Befehlen `QSELECT` oder `SELECTSIMILAR` können Objekte nach Eigenschaften (Layer, Farbe, Typ usw.) gefiltert und ausgewählt werden.
- Die Auswahl ist abgeschlossen, sobald Enter gedrückt wird (bei aktivem Befehl) bzw. sobald der nächste Befehl gestartet wird (bei vorheriger Auswahl).
