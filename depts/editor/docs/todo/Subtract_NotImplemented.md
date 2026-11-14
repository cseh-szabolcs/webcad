# DIFFERENZ und VEREINIG: noch nicht umgesetzt

DIFFERENZ (AutoCAD `SUBTRACT`, zwei Objektwahlen) und VEREINIG (`UNION`, eine Objektwahl) sind
für geschlossene Polylinien und Kreise umgesetzt (siehe `docs/bedienung.md`); das Ergebnis sind
exakte Umrisse aus Strecken und Kreisbögen. Offen ist Folgendes, jeweils mit dem, was dafür
fehlt; es gilt für beide Befehle, wo nichts anderes steht:

## Regionen

AutoCAD subtrahiert nur Regionen (Befehl `REGION` bzw. `BOUNDARY` wandelt geschlossene Objekte
um) und liefert **eine** Region, auch mit Löchern oder aus getrennten Teilen. Das Modell hat kein
Element mit mehreren Umrissen, deshalb:

- Mehrere Umrisse sind einzelne Elemente in einer Gruppe. **Eine Füllfarbe spart ein Loch nicht
  aus**: Außenumriss und Loch haben denselben Stil und werden beide gefüllt. Ein Element
  `region` (mehrere Umrisse, Füllung nach gerade/ungerade) braucht Entity, DTO und OpenAPI-Typen
  im Backend, im Editor Renderer (`PathSpec` als zusammengesetzter Pfad), Picking, Objektfang
  und Grips.
- Ein Loch ist danach ein gewöhnliches Objekt: Wird es in einer zweiten DIFFERENZ zusammen mit
  seinem Außenumriss als "von denen subtrahiert werden soll" gewählt (die Gruppe wählt beide),
  zählt seine Fläche wieder mit, das Loch ist also gefüllt; ebenso füllt VEREINIG ein Loch,
  das mit seinem Außenumriss gewählt wird. Erst eine Region weiß, was Loch ist.

## Objekte

- **Ellipsen** und **Splines** (Bézier): Das Ergebnis bräuchte Ellipsenbögen bzw. Kurvenstücke
  als Segmente eines Umrisses, die eine Polylinie nicht speichern kann. Möglich wäre eine
  Näherung durch kurze Strecken oder Bögen (nicht mehr exakt) oder die Region oben mit
  beliebigen Kanten.
- **Offene Objekte, die zusammen eine Fläche umschließen** (Linien und Bögen Ende an Ende):
  AutoCADs `REGION` setzt sie zusammen. Hier werden sie übergangen.
- **Sich selbst schneidende Polylinien** lehnt AutoCADs `REGION` ab. Hier werden sie nicht
  geprüft; ihre Fläche zählt nach der Windungszahl, das Ergebnis kann überraschen.
- Geschlossene Polylinien mit zwei Scheitelpunkten (Linse aus zwei Bögen) zeichnet der Editor
  nicht geschlossen (`polylineSegments`); ein solches Ergebnis bekommt deshalb einen dritten
  Punkt in der Mitte eines Bogens.

## Bedienung

- **Vorschau** des Ergebnisses, bevor die (bei DIFFERENZ zweite) Auswahl mit Enter beendet wird.
- VEREINIG teilt gemischte Auswahlen in AutoCAD in Teilmengen je Ebene und Objektart, die
  getrennt vereinigt werden. Hier gibt es nur eine Ebene und eine Art von Fläche.
- **Zu prüfen gegen AutoCAD:** der deutsche Wortlaut der Meldung bei weniger als zwei Objekten.
- **Zu prüfen gegen AutoCAD:** ob die erste Auswahl während der zweiten hervorgehoben bleibt
  (hier ja), die genauen deutschen Aufforderungen (AutoCAD nennt "Volumenkörper, Flächen und
  Regionen"), und die Meldung, wenn nichts übrig bleibt.
- Aktueller Layer und Stil spielen keine Rolle: Das Ergebnis übernimmt Layer, Stil und Namen
  des ersten Objekts der ersten Auswahl. **Zu prüfen gegen AutoCAD**, von welchem Objekt die
  neue Region ihre Eigenschaften hat.

## Verwandter Befehl

`SCHNITTMENGE` (`INTERSECT`): `subtractShapes` in `src/cad/geometry/regionBoolean.ts` teilt die
Kanten und entscheidet je Kantenstück über einen Punkt links und rechts davon, ob es Rand des
Ergebnisses ist. Für die Schnittmenge ändert sich nur diese Bedingung (in allen Flächen statt in
einer der ersten und keiner der zweiten). Dazu ein Werkzeug wie `UnionTool` und ein weiteres
`label` für `SubtractCommand`.
