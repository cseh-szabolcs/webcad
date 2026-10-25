PLINIE (AutoCAD PLINE) nach `docs/specs/PLINE_Werkzeug_Spezifikation.md`: was der erste Schritt umsetzt und was später kommt.

Umgesetzt (erster Schritt, so in bedienung.md beschrieben):

- Start über Button, `PLINIE`, `PLINE`, `PL`; Wiederholen mit Enter/Rechtsklick bei `Befehl:`.
- `Startpunkt angeben:` mit Fang, Spuren, Koordinaten; Enter setzt am Endpunkt der zuletzt mit LINIE oder PLINIE gezeichneten Linie oder Polylinie fort.
- Gerade Segmente mit Polarspur, Ortho, OTRACK, Direkter Distanzeingabe und DYN wie bei LINIE.
- Optionen `Zurück`, `Schließen` und `sehnenLänge` (die beiden letzten ab einem Segment).
- Enter, Rechtsklick und Esc beenden und behalten die Polylinie; sie ist ein Element und ein Rückgängig-Schritt.
- Vorschau der bisherigen Segmente plus Segment zum Cursor; die Polylinie kommt erst beim Beenden ins Dokument, ihre Segmente sind bis dahin nicht fangbar.

Später, in dieser Reihenfolge vorgeschlagen:

1. ~~Option `sehnenLänge` (Length)~~: umgesetzt mit der Abfrageart `distance` (Zahl, oder Abstand vom letzten Punkt zu einem Punkt), ab einem Segment, nur positive Längen, ein DYN-Abstandsfeld. Offen: nach einem Bogen tangential zum Bogen (kommt mit 2); ohne Segment im Lauf (nur Startpunkt) ist die Option bewusst nicht angeboten.
2. **Bogensegmente (Option `Kreisbogen` mit Winkel, Mittelpunkt, Richtung, Linie, Radius, Zweiter Punkt):** Schema-Entscheidung nötig. Vorschlag: optionales `bulges?: number[]` an `PolylineElement`, ein Wert je Segment (wie DXF/AutoCAD: tan(Öffnungswinkel/4), Vorzeichen = Richtung, 0 = gerade; beim geschlossenen auch für das schließende Segment). Optional, damit vorhandene Dokumente gültig bleiben; das berührt Serializer, Renderer (`PathSpec`), `ElementShapes`, `SnapGeometry` (END/MID/CEN/QUA/INT auf Bögen), Griffe, Schwerpunkt (GCE), `MoveCommand` und Fixture/Beispielplan. Hängt an der offenen Frage der Schema-Versionierung (CLAUDE.md). Danach: tangentialer Übergang Linie → Bogen → Linie, Bogenvorschau, `Schließen` mit Bogen, und tangentiales Fortsetzen (LINIE/PLINIE an Bögen).
3. **Breite und Halbbreite (Width/Halfwidth):** Start-/Endbreite je Segment im Schema (z. B. `widths?: [number, number][]`), Darstellung als Fläche mit Gehrung an den Ecken, Breitenvorschau, Meldung `Aktuelle Linienbreite beträgt …` beim Start. Klären, wie sich das zu Stil-Strichstärken verhält.
4. **Fangen an den eigenen Segmenten während des Befehls:** AutoCAD bietet das nicht (die Polylinie existiert erst am Ende). Wäre bei Bedarf über eine temporäre Fanggeometrie im Editor-Kern möglich, ohne das Dokument zu ändern.
5. **Temporäres Markierungskreuz am Startpunkt** (spezifiziert, in AutoCAD nur mit BLIPMODE).
6. Aktueller Layer und Stil für neue Objekte, geteilte Punkte mit Nachbarobjekten (siehe `Vertex_Handling_NotDecided.md`), Bearbeitung mit Griffen und PEDIT.
7. **Leertaste wie Enter** (Spezifikation Abschnitte 1 und 8): gilt für alle Befehle; bisher verschiebt die Leertaste ohne getippten Text bewusst die Ansicht (siehe bedienung.md).
8. **Optionen im DYN-Tooltip** (Abschnitt 7): das ↓-Menü der dynamischen Eingabe fehlt für alle Befehle (siehe `Dynamic_Input_NotImplemented.md`).

Bewusst nicht vorgesehen: PLINETYPE (Lightweight oder Legacy, Abschnitt 10). Unser Modell kennt nur eine Art Polylinie.
