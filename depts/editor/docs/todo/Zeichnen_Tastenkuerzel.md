# Tastenkürzel wie in AutoCAD – was noch fehlt

Sammlung der AutoCAD-Kürzel, die für den Editor (`depts/editor/`) später in Frage kommen, mit
Stand und Hinweisen zur Umsetzung. Was umgesetzt ist, beschreibt
`depts/editor/docs/bedienung.md`; diese Datei ist nur die Merkliste.

Legende: ✅ umgesetzt · ⬜ offen · ⚠️ offen, mit Konflikt (siehe Hinweis)

## 1. Temporäre Überschreibungstasten (gehalten)

In AutoCAD wirken sie nur, solange die Tasten gedrückt sind (Systemvariable `TEMPOVERRIDES`,
standardmäßig an). Jede gibt es für die linke und die rechte Hand.

| Taste (gehalten)          | Wirkung                                                   | Stand |
|---------------------------|-----------------------------------------------------------|-------|
| Shift                     | Ortho umschalten (aus → an, an → aus)                     | ✅ |
| Shift+A bzw. Shift+'      | Objektfang (OFANG) umschalten                             | ⚠️ |
| Shift+X bzw. Shift+.      | Polarspur umschalten                                      | ⚠️ |
| Shift+Q bzw. Shift+]      | Objektfangspuren (OTRACK) umschalten                      | ⚠️ |
| Shift+D bzw. Shift+L      | Alle Fänge und Spuren aus                                 | ⚠️ |
| Shift+E bzw. Shift+P      | Nur Endpunkt fangen                                       | ⚠️ |
| Shift+M bzw. Shift+V      | Nur Mittelpunkt fangen                                    | ⚠️ |
| Shift+C bzw. Shift+,      | Nur Zentrum fangen                                        | ⚠️ |
| Shift+S bzw. Shift+;      | Objektfang erzwingen (nur Fangpunkte, kein freier Punkt)  | ⚠️ |
| Shift+W bzw. Shift+U      | Dynamisches BKS umschalten                                | – (kein BKS) |

Hinweise:

- **Konflikt mit dem Tippen:** An Punkt-Aufforderungen geht jede Taste in die Kommandozeile
  bzw. die DYN-Felder. Shift+Buchstabe ist dort ein Großbuchstabe (z. B. `S` für Schließen bei
  LINIE). Vor der Umsetzung klären, wie AutoCAD das genau entscheidet (z. B. Überschreibung nur
  bei leerer Eingabe, oder erst wenn die Kombination länger gehalten wird) und ob wir dem
  folgen.
- **Tastaturbelegung:** Die rechten Varianten (`'`, `.`, `]`, `;`, `,`) liegen auf deutschen
  Tastaturen woanders und brauchen teils selbst Shift. Physische Tasten über `event.code`
  statt `event.key` auswerten, oder die rechten Varianten weglassen.
- **Umsetzung:** `canvasInput` müsste gehaltene Tasten (keydown/keyup nach `event.code`, Reset
  bei `blur`) verfolgen und dem Editor melden, so wie heute Shift über
  `InputTarget.setShiftHeld`. Der Editor wendet sie als vorübergehende Überschreibung auf
  `SnapSettings`, `PolarSettings` und `ObjectTrackingSettings` an, ohne App-State und
  Statusleiste zu ändern (wie `SelectionEditor.orthoActive`).
- Eine Einstellung wie `TEMPOVERRIDES` in `EditorSettings`, um das abzuschalten.

## 2. Mausaktionen mit Tasten

| Aktion                         | Wirkung in AutoCAD                                      | Stand |
|--------------------------------|---------------------------------------------------------|-------|
| Shift+Klick (ohne Befehl / Objekte wählen) | Aus der Auswahl entfernen                   | ✅ |
| Rechtsklick                    | Wie Enter bzw. letzten Befehl wiederholen (Rechtsklick-Anpassung) | ✅ |
| Shift+Rechtsklick              | Objektfang-Menü (Fangmodus für einen Punkt wählen)      | ⬜ |
| Rechtsklick lang halten        | Kontextmenü (zeitabhängiger Rechtsklick)                | ⬜ |
| Shift beim Verweilen auf einem Fangpunkt | OTRACK: Punkt nur mit Shift erfassen (Option „Mit Shift erfassen“) | ⬜ |

## 3. Funktionstasten

| Taste | Wirkung                          | Stand |
|-------|----------------------------------|-------|
| F3    | Objektfang ein/aus               | ✅ |
| F7    | Raster ein/aus                   | ✅ |
| F8    | Ortho ein/aus                    | ✅ |
| F10   | Polarspur ein/aus                | ✅ |
| F11   | Objektfangspuren ein/aus         | ✅ |
| F12   | Dynamische Eingabe ein/aus       | ✅ |
| F1    | Hilfe                            | ⬜ (Browser-Hilfe abfangen) |
| F2    | Erweiterter Befehlsverlauf       | ⬜ |
| F9    | Rasterfang (Fangmodus) ein/aus   | ⬜ |
| F6    | Dynamisches BKS                  | – (kein BKS) |

## 4. Strg-Kürzel

| Taste            | Wirkung in AutoCAD                     | Stand / Hinweis |
|------------------|----------------------------------------|-----------------|
| Strg+Z           | Rückgängig                             | ✅ |
| Strg+Y           | Wiederherstellen                       | ✅ (auch ⌘+⇧+Z) |
| Strg+A           | Alles wählen                           | ⬜ |
| Strg+Shift+A     | Gruppenauswahl ein/aus (PICKSTYLE)     | ⬜ |
| Strg+C / Strg+X / Strg+V | Kopieren, Ausschneiden, Einfügen (Zwischenablage) | ⬜ |
| Strg+S           | Speichern                              | ⬜ (sobald gespeichert wird) |
| Strg+F, Strg+G, Strg+L, Strg+U, Strg+B | Wie F3, F7, F8, F10, F9  | ⬜ Browser-Konflikt prüfen (Strg+F Suche, Strg+L Adressleiste) |
| Strg+1           | Eigenschaften-Palette                  | ⬜ (gibt es noch nicht) |
| Strg+9           | Kommandozeile ein/aus                  | ⬜ |
| Strg+0           | Bildschirm bereinigen                  | ⬜ (Vollbild gibt es schon) |
| Strg+N, Strg+W, Strg+T | Neu, Auswahlzyklus, Tablett      | – Browser lässt sich nicht zuverlässig abfangen |

## 5. Getippte Kürzel

| Eingabe                          | Wirkung                                         | Stand |
|----------------------------------|-------------------------------------------------|-------|
| `L`, `LINIE`, `LINE`             | Befehl LINIE                                    | ✅ |
| `SCHIEBEN`, `MOVE`               | Befehl SCHIEBEN                                 | ✅ |
| `M`                              | Englisches Kurzzeichen für MOVE                 | ⬜ (deutsches Kurzzeichen vorher in der AutoCAD-`acad.pgp` prüfen) |
| `_` vor Befehl oder Option       | Englischer Name in jeder Sprache (z. B. `_U`)   | ⬜ |
| `END`, `MIT`/`MID`, `ZEN`/`CEN`, `SCH`/`INT`, `QUA` … an einer Punkt-Aufforderung | Fang-Überschreibung für den nächsten Punkt | ⬜ |
| `VON`/`FROM`, `SPU`/`TT`, `M2P`  | Von-Punkt, Spurpunkt, Mitte zwischen 2 Punkten  | ⬜ |
| Pfeil ↑ / ↓                      | Eingabe-Historie bzw. DYN-Optionsmenü           | ⬜ |

Die deutschen Kürzel der Fang-Überschreibungen vor der Umsetzung im deutschen AutoCAD prüfen.
