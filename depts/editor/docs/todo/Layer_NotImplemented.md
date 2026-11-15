# Layer: noch nicht umgesetzt

Die Layer sind umgesetzt (siehe `docs/bedienung.md`, „Layer“, und
`docs/specs/Layer_System_Spezifikation.md`). Offen ist Folgendes, jeweils mit dem, was dafür fehlt:

## Eigenschaften

- **Linienstärke ein-/ausblenden** (AutoCAD: Schalter LST, LWDISPLAY) und ihr Anzeigemaßstab
  (LWSCALE): Sie wird immer gezeichnet, mit `LINEWEIGHT_PX_PER_MM`
  (`src/cad/renderer/elementDisplay.ts`). Auch „Vorgabe“ (LWDEFAULT) als eigener Wert fehlt: Ein
  neuer Layer bekommt fest `DEFAULT_LINEWEIGHT`.
- **Aktueller Stil für neue Objekte** und einen Stil per Klick in der Liste zuweisen: Zugewiesen
  wird über das Feld „Stil“ der Auswahl (`SelectionEditor.setSelectionStyle`).
- **Woher ein Wert kommt** (Objekt, Stil oder Layer) je Feld der Auswahl anzeigen: Bisher steht
  nur `VonLayer` bzw. `VonStil/Layer`.
- **Stile je Stockwerk oder aus einer Bibliothek** (planübergreifend), Stile kopieren.
- **Strichstärke der Füllung, Schraffuren**: Ein Stil hat nur eine Füllfarbe.
- **Aktuelle Werte für neue Objekte** (AutoCAD: CECOLOR, CELTYPE, CELWEIGHT, CETRANSPARENCY): Neue
  Objekte legen nichts selbst fest (`BY_LAYER`).
- **VonBlock** (ByBlock): erst mit den Blöcken.
- **ACI-Farben** (AutoCAD Color Index 1–255): erst mit dem DXF-Import nötig; dann eine Tabelle
  ACI → `#rrggbb` und die Entscheidung, ob der Index gespeichert wird.
- **Linientypen aus einer Tabelle** (eigene Muster, Maßstab LTSCALE): Heute sind es sechs feste
  Muster in Bildschirmpixeln (`LINETYPE_DASHES`).
- **Plotten** je Layer ein/aus: erst mit dem Export.
- **Gesperrte Layer abgeblendet** zeichnen wie AutoCAD (LAYLOCKFADECTL).

## Bedienung

- **Layer eines anderen Objekts übernehmen** (AutoCAD: LAYMCH „Layer anpassen“, LAYMCUR „Layer
  des Objekts aktuell machen“): Objekte kommen bisher nur über die Layer-Liste auf einen anderen
  Layer (`SelectionEditor.moveSelectionToLayer`, `ChangeElementLayerCommand`).
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
  (LAYISO).
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
