# SPIEGELN: noch nicht umgesetzt

SPIEGELN (AutoCAD `MIRROR`) ist umgesetzt (siehe `docs/bedienung.md` und
`docs/specs/MIRROR_Werkzeug_Spezifikation.md`). Offen ist Folgendes, jeweils mit dem, was dafür fehlt:

## Objekte, die das Modell nicht hat

- **Text** (`MIRRTEXT`): Es gibt kein Text-Element. Mit ihm braucht es die Einstellung
  `mirrorText` (Vorgabe aus: der Text wird versetzt, bleibt aber lesbar) in
  `src/settings/editorSettings.ts` und einen Zweig in `transformShape`
  (`src/cad/editor/commands/TransformCommand.ts`).
- **Schraffuren** (`MIRRHATCH`) und **Blöcke** (Einfügepunkt spiegeln, Drehung und negative
  Skalierung anpassen): ebenso erst mit den Elementen selbst.

## Bedienung

- **Auswahlarten** Zaun (Fence) und Fenster-/Kreuzen-Polygon bei `Objekte wählen:`; das fehlt
  allen Befehlen, nicht nur SPIEGELN.
- **Schlüsselwörter per Klick**: AutoCAD lässt die Optionen `[Ja/Nein]` in der Kommandozeile
  anklicken und zeigt sie bei dynamischer Eingabe als Liste am Cursor; hier werden sie getippt.
- **Englische Optionen mit `_`** im deutschen Editor (`_Y`, `_N`), wie bei den anderen Befehlen.
- **Vorschau der Löschung**: Bei `Quellobjekte löschen?` bleiben die Originale hervorgehoben,
  was auch immer danach gewählt wird.
- **Sperre durch andere**: Rückgängig und Wiederherstellen prüfen die Sperre der Zusammenarbeit
  noch nicht (wie bei allen Befehlen).
