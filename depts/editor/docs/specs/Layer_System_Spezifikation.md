# Layer-System für WebCAD (nach AutoCAD)

Layer ordnen die Zeichnung und steuern Sichtbarkeit und Darstellung der Objekte, so nah an
AutoCAD wie sinnvoll. Diese Spezifikation hält fest, was gilt und wo WebCAD bewusst abweicht.
Die Bedienung im Einzelnen steht in `docs/bedienung.md` („Layer“), was noch fehlt in
`docs/todo/Layer_NotImplemented.md`.

## Aufbau: Stockwerk → Layer → Objekt

- Ein **Stockwerk** (`Floor`) ist die oberste Ebene eines Plans. AutoCAD kennt es nicht.
- Ein **Layer** gehört zu genau einem Stockwerk (`floorId`).
- Ein **Objekt** liegt auf genau einem Layer (`layerId`, nie leer).

Der Benutzer sieht später nur Layer und Objekte des Stockwerks, in dem er ist (Tabs unter der
Werkzeugleiste). Umgesetzt ist davon das Datenmodell mit einem Standard-Stockwerk; der Editor
zeigt das erste Stockwerk des Plans.

## Datenmodell

```typescript
interface Floor {
  id: string;
  name: string;
}

interface Layer {
  id: string;
  floorId: string;        // das Stockwerk des Layers
  name: string;           // je Stockwerk eindeutig, ohne Groß/Klein
  visible: boolean;       // ein Schalter statt Ein/Aus und Frieren
  locked: boolean;
  color: string;          // "#rrggbb"
  linetype: 'continuous' | 'dashed' | 'hidden' | 'center' | 'dot' | 'dashDot';
  transparency: number;   // 0 (deckend) bis 90, in Prozent
  lineweight: number;     // in 1/100 mm wie DXF, einer der Werte von AutoCAD
  description: string;    // freier Text, leer für keinen
}
```

Die Reihenfolge der Layer im Dokument ist die Zeichenreihenfolge: ein späterer Layer liegt
obenauf. (AutoCAD kennt keine Reihenfolge der Layer; sie stammt aus dem bisherigen Modell.)

### Werte eines neuen Layers

`visible: true`, `locked: false`, `color: "#000000"`, `linetype: "continuous"`,
`transparency: 0`, `lineweight: 25` (0,25 mm, AutoCADs Vorgabe), `description: ""`. Schwarz wird auf dunklem Hintergrund hell gezeichnet, wie
AutoCADs Farbe 7 (Weiß/Schwarz je nach Hintergrund). Der Name ist der nächste freie aus
`Layer1`, `Layer2`, …

### Layer 0

Jedes Stockwerk hat den Layer `0`. Er lässt sich weder löschen noch umbenennen. (In AutoCAD hat
er zudem eine Sonderrolle in Blöcken; das wird mit den Blöcken entschieden.)

### Layername

- Je Stockwerk eindeutig; Groß- und Kleinschreibung zählt dabei nicht.
- Höchstens 255 Zeichen, nicht leer; Leerzeichen am Rand fallen weg.
- Nicht erlaubt wie in AutoCAD: `<` `>` `/` `\` `"` `:` `;` `?` `*` `|` `,` `=` und der Gravis.

## Sichtbar statt Ein/Aus und Frieren

AutoCAD unterscheidet „Aus“ (unsichtbar, aber regeneriert und per „Alles wählen“ wählbar) und
„Gefroren“ (unsichtbar, nicht regeneriert, nicht wählbar). WebCAD hat **einen** Schalter
`visible` mit der Wirkung von Frieren. Ein ausgeblendeter Layer wird

- nicht gezeichnet,
- nicht gefangen,
- nicht gewählt (auch nicht per Fenster, Kreuzen oder Lasso),
- nicht in die Grenzen der Zeichnung eingerechnet („Zoom Grenzen“).

Begründung: Im Browser gibt es keine Regenerierung, also keinen Unterschied in der Leistung.
Übrig bliebe ein Unterschied bei Blöcken (ein gefrorener Einfüge-Layer blendet die ganze
Blockreferenz aus, „Aus“ nur die Objekte, die auf dem Layer gezeichnet sind); das wird mit den
Blöcken entschieden. Ein späterer DXF-Export schreibt einen ausgeblendeten Layer als gefroren.

`locked`: Der Layer wird gezeichnet und gefangen, seine Objekte lassen sich nicht wählen. Neue
Objekte lassen sich darauf zeichnen, wie in AutoCAD.

## Aktueller Layer

- Es gibt je Benutzer und Stockwerk genau einen aktuellen Layer; neue Objekte liegen auf ihm.
- Er ist **Zustand des Editors, nicht Teil der Zeichnung** (AutoCAD speichert CLAYER in der
  Zeichnung): In der Zusammenarbeit würden sich die Beteiligten sonst gegenseitig umstellen.
  Beim Öffnen ist es der Layer `0`.
- Er ist immer sichtbar: Er lässt sich nicht ausblenden, und ein ausgeblendeter Layer, der
  aktuell gemacht wird, wird dabei eingeblendet. Verschwindet er oder wird er ausgeblendet
  (Rückgängig, andere Beteiligte), gilt der Layer `0`, ist auch der ausgeblendet, der erste
  sichtbare Layer des Stockwerks.
- Er lässt sich nicht löschen.

## VonLayer (ByLayer)

Ein Objekt hat einen optionalen Stil (`styleId`, ein `ElementStyle` mit Strichfarbe,
Strichstärke, Strichmuster und Füllung).

- **Ohne Stil** (`styleId: null`) zeichnet das Objekt VonLayer: mit Farbe, Linientyp,
  Linienstärke und Transparenz seines Layers, ohne Füllung. Neue Objekte haben keinen Stil.
- **Mit Stil** zeichnet es ganz nach dem Stil; der Layer wirkt dann nicht auf sein Aussehen.

AutoCAD überschreibt je Eigenschaft (Farbe, Linientyp, Linienstärke, Transparenz einzeln VonLayer oder
eigen); das ist hier noch nicht möglich.

- **Linientyp:** Strichmuster in Bildschirmpixeln, unabhängig vom Zoom (wie die Strichmuster der
  Stile): durchgezogen, gestrichelt, verdeckt, Mitte, Punkt, Strichpunkt.
- **Linienstärke:** AutoCADs feste Werte 0,00 / 0,05 / 0,09 / 0,13 / 0,15 / 0,18 / 0,20 / 0,25 /
  0,30 / 0,35 / 0,40 / 0,50 / 0,53 / 0,60 / 0,70 / 0,80 / 0,90 / 1,00 / 1,06 / 1,20 / 1,40 / 1,58 /
  2,00 / 2,11 mm, gespeichert in 1/100 mm. Wie in AutoCADs Modellbereich wird sie in
  Bildschirmpixeln im Verhältnis zum Wert gezeichnet, unabhängig vom Zoom (0,25 mm = 1 px, nie
  dünner); die mm zählen beim Plotten. Sie wird immer angezeigt (AutoCAD: Schalter LST).
- **Transparenz:** Deckkraft `1 − transparency / 100`.
- **Farbe:** `#rrggbb`. ACI-Farben (AutoCAD Color Index) kommen mit dem DXF-Import.

## Bedienung

Ein Panel rechts neben der Zeichenfläche, wie die Seitenleiste von Visual Studio Code:

- Es schiebt sich mit einer CSS-Transition ein; ein Button rechts in der Werkzeugleiste und ein
  kleiner Button mittig am rechten Rand der Zeichenfläche öffnen und schließen es.
- Seine Breite lässt sich am linken Rand ziehen, zwischen den Einstellungen
  `layerPanelMinWidth` und `layerPanelMaxWidth`; Startbreite `layerPanelWidth`.
- Inhalt: oben der aktuelle Layer mit seinen Einstellungen (Name, Farbe, Linientyp,
  Linienstärke, Transparenz, Beschreibung), darunter **+ Layer hinzufügen**, darunter die Layer
  des Stockwerks (ein Klick macht einen aktuell; je Zeile Sichtbar, Gesperrt, Löschen).
- **Objekte auf einen anderen Layer legen** wie in AutoCADs Layer-Liste: Sind Objekte gewählt,
  legt der Klick auf einen Layer die Auswahl dorthin statt ihn aktuell zu machen; der aktuelle
  Layer und die Auswahl bleiben. Die Liste markiert die Layer der gewählten Objekte.

Später zeigt die Liste unter jedem Layer seine Objekte zum Anwählen (Accordion, anfangs
aufgeklappt).

## Regeln

1. Der Layer `0` kann nicht gelöscht oder umbenannt werden.
2. Ein Layer mit Objekten kann nicht gelöscht werden.
3. Der aktuelle Layer kann weder gelöscht noch ausgeblendet werden.
4. Änderungen an Layern wirken sofort auf die Zeichnung.
5. Jede Layer-Änderung ist ein Schritt für Rückgängig/Wiederherstellen (`LAYER`).
6. Layer werden nur geändert, solange kein Befehl läuft; den aktuellen Layer zu wechseln geht
   immer (außer auf einen ausgeblendeten).
7. Layer-Änderungen gehen an alle, die den Plan offen haben; Sichtbarkeit und Sperre gehören
   zur Zeichnung und gelten damit für alle.

## Umsetzung

- Modell und Regeln: `src/cad/model/Layer.ts`, `src/cad/model/Floor.ts`,
  `src/cad/editor/layers.ts` (Namen, Löschen, aktueller Layer; pur und getestet).
- Befehle: `src/cad/editor/commands/LayerCommands.ts` (`AddLayerCommand`,
  `UpdateLayerCommand`, `RemoveLayerCommand`, `ChangeElementLayerCommand`); der Editor-Kern prüft
  die Regeln (`SelectionEditor.addLayer`, `updateLayer`, `removeLayer`, `setCurrentLayer`,
  `moveSelectionToLayer`).
- Darstellung: `src/cad/renderer/elementDisplay.ts` (VonLayer), `PaperRenderer.updateLayers`.
- Panel: `src/ui/SidePanel.tsx`, `src/ui/LayerPanel.tsx`.
- Backend: `src/Plan/Entity/Floor.php`, `Layer.php`, die DTOs in `src/Plan/Dto`.
