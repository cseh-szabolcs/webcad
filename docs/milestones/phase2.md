Phase 2, Schnitt 1 ist fertig: Man kann Elemente auswählen, löschen und das rückgängig machen bzw. wiederholen. Die 53 Vitest-Tests laufen grün, Build und Lint sind sauber. Im Browser habe ich Hover, Klick, Shift-Klick, Leerklick, Entf/Backspace, Cmd+Z, Cmd+Shift+Z, den Undo-Button und Pan mit mittlerer Maustaste bzw. Leertaste geprüft, ohne Konsolenfehler.

Neu unter src/cad/editor/:
- CadEditor hält das unveränderliche Dokument, die Undo-History, die Auswahl und das aktive Tool. Er hängt weder von React noch von Paper ab und spricht nur über EditorView mit der Darstellung. React liest seinen Zustand über useEditorSnapshot, der Snapshot entsteht nur bei echten Änderungen neu.
- Commands:
  - Command beschreibt eine reine Funktion doc → doc mit Undo. Sie gibt zusätzlich die geänderten Element-ids zurück, damit der Renderer gezielt neu zeichnet.
  - CommandManager verwaltet Undo/Redo.
  - DeleteElementsCommand entfernt verwaiste Vertices gleich mit. Undo stellt Elemente und Vertices an ihren alten Positionen wieder her.
- Auswahl und Tool: SelectionManager verwaltet Auswahl und Hover, SelectTool setzt sie um.
- CanvasInputController ersetzt den PanZoomController. Er entscheidet zentral zwischen Navigation (Rad, mittlere Maustaste, Leertaste) und Tool-Eingaben inklusive Tastatur.

Im Renderer:
- Hit-Testing mit 6 px Toleranz, gesperrte und ausgeblendete Layer werden übersprungen.
- Eine eigene Overlay-Ebene, die setDocument überlebt.
- Wieder eingefügte Elemente landen an ihrer ursprünglichen Stelle in der Zeichenreihenfolge.

Toolbar: Buttons für Undo, Redo und Delete, mit Labels wie "Undo: Delete 2 elements" als Tooltip, dazu die Anzeige "N selected".

Abweichungen vom Plan:
- EditorView hat statt getItemPath/overlayLayer eine Methode renderSelection(selected, hovered). Die Paper-Details stecken in PaperEditorView und SelectionOverlay. So bleibt der Editor-Core frei von Paper und der Renderer frei von Editing-Zustand.
- CanvasInputController liegt unter cad/editor/ statt unter renderer/, weil er Editor-Typen braucht und der Renderer nicht vom Editor abhängen soll.
- vertexRefs() ist nach model/CadElement.ts gewandert, wie geplant.

Nicht automatisch getestet: Hit-Testing und Overlay brauchen eine Canvas und sind deshalb nur im Browser geprüft. Die Unit-Tests decken den Editor mit einem Fake-View ab. Außerdem wechselt das Klicken auf einen Toolbar-Button den Fokus. Die Shortcuts funktionieren trotzdem, weil sie auf window hören.

CLAUDE.md beschreibt jetzt Editor-Core, Eingabebelegung und die Vertex-Regel. Committet ist weiterhin nichts. Als nächster Schritt würde Verschieben passen: Auswahl ziehen, Vorschau anzeigen, beim Loslassen ein MoveVerticesCommand ausführen. Danach kämen Vertex-Handles.