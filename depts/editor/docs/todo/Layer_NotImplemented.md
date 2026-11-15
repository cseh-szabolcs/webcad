# Layer: noch nicht umgesetzt

Die Layer sind umgesetzt (siehe `docs/bedienung.md`, „Layer“, und
`docs/specs/Layer_System_Spezifikation.md`). Offen ist Folgendes, jeweils mit dem, was dafür fehlt:

## Eigenschaften

- **Linienstärke** (AutoCAD: Lineweight) je Layer: ein Feld `lineweight` am Layer (Backend
  `Layer`, `LayerDto`, Schema neu), in `layerDisplay` (`src/cad/renderer/elementDisplay.ts`)
  statt `LAYER_STROKE_WIDTH`. Vorher zu klären: Bildschirmpixel wie bei den Stilen oder mm auf
  dem Papier.
- **Überschreibung je Eigenschaft** wie in AutoCAD (Farbe, Linientyp, Transparenz einzeln
  VonLayer oder eigen): Heute überschreibt ein `ElementStyle` den Layer als Ganzes
  (`elementDisplay`). Dazu gehört ein Eigenschaften-Panel für die Auswahl und „aktuelle“ Werte
  für neue Objekte (AutoCAD: CECOLOR, CELTYPE).
- **ACI-Farben** (AutoCAD Color Index 1–255): erst mit dem DXF-Import nötig; dann eine Tabelle
  ACI → `#rrggbb` und die Entscheidung, ob der Index gespeichert wird.
- **Linientypen aus einer Tabelle** (eigene Muster, Maßstab LTSCALE): Heute sind es sechs feste
  Muster in Bildschirmpixeln (`LINETYPE_DASHES`).
- **Plotten** je Layer ein/aus: erst mit dem Export.
- **Gesperrte Layer abgeblendet** zeichnen wie AutoCAD (LAYLOCKFADECTL).

## Bedienung

- **Objekte auf einen anderen Layer legen** (AutoCAD: Layer-Auswahl bei gewählten Objekten,
  LAYMCUR, „Layer anpassen“): ein Befehl, der `layerId` der gewählten Elemente setzt
  (`changedElementIds` = diese Elemente; der Renderer baut dann neu auf, weil sie die
  Paper.js-Ebene wechseln).
- **Löschen mit Verschieben:** Ein Layer mit Objekten lässt sich nicht löschen; AutoCADs LAYMRG
  (Objekte auf einen anderen Layer legen, dann löschen) fehlt.
- **Reihenfolge** der Layer ändern (Ziehen in der Liste) und **Sortieren/Filtern** nach Name: Die
  Liste zeigt die Zeichenreihenfolge. Ein Befehl, der `doc.layers` umordnet; `planLayerUpdate`
  verlangt dafür heute einen Neuaufbau.
- **Befehl `LAYER`** (Alias `LA`) bei `Befehl:`, der das Panel öffnet, und `-LAYER` mit Optionen
  in der Kommandozeile: `LAYER` ist bisher nur der Name des Rückgängig-Schritts (`LayerLabel` in
  `commandNames.ts`), kein Eintrag in `commandAliases.json`.
- **Layer wechseln oder ändern, während ein Befehl läuft** (AutoCAD: transparent): Geändert
  werden Layer nur im Leerlauf, weil LINIE seine Schritte mit `combineLast` zählt
  (`SelectionEditor.layersBusy`).
- **Mehrere Layer zugleich** wählen und ändern, alle ein-/ausblenden, „Layer isolieren“
  (LAYISO), „Layer des Objekts aktuell machen“ (LAYMCUR).
- **Objekte in der Liste:** Unter jedem Layer seine Objekte zum Anwählen, als Accordion, anfangs
  aufgeklappt.
- **Aktueller Layer je Plan merken:** Er beginnt nach jedem Laden bei `0`.
- **Tastatur im Panel:** Enter und Leertaste auf einem Button gehen wie bei der Werkzeugleiste
  an den Editor (`canvasInput`), nicht an den Button.

## Stockwerke

- **Tabs** unter der Werkzeugleiste, Anlegen, Umbenennen, Löschen, Wechseln: Das Datenmodell
  hat `floors` und `floorId` am Layer; der Editor zeigt das erste Stockwerk
  (`SelectionEditor.floorId`). Renderer, Auswahl und Fang müssen dann auf das gezeigte Stockwerk
  beschränkt werden.
- **Zusammenarbeit:** Zeiger und Auswahl von Personen in einem anderen Stockwerk nicht zeigen;
  Stockwerke gehören noch nicht zum `DocumentPatch`.

## Speichern

- Layer-Änderungen werden wie alle Änderungen noch nicht gespeichert (kein Schreib-Endpunkt).
- Das Backend prüft nur die Verweise (`PlanFactory`); dass jedes Stockwerk einen Layer `0` hat
  und die Namen eindeutig sind, prüft bisher nur der Editor (`CadSerializer`).
