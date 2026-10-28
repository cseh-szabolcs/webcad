# Browserbasierte 2D-CAD-Software – Architekturkonzept

> Technische Zusammenfassung der besprochenen Architektur, des Backends, Frontends, Datenmodells und des schrittweisen Entwicklungsplans.

## 1. Zielsetzung

Geplant ist eine **browserbasierte 2D-CAD-Anwendung für Architekten und Planer**. Sie soll bewusst schlanker und leichter bedienbar sein als klassische CAD-Komplettlösungen. Der Schwerpunkt liegt auf präzisem Zeichnen mit Linien, Polylines, Kreisen und Bézier-Kurven sowie auf intelligenten Hilfen wie Snapping, geometrischer Inference und temporären Hilfslinien.

Die Anwendung soll langfristig auch Projektverwaltung, Planversionen, Exportfunktionen und weitere organisatorische Funktionen unterstützen. Umfangreiche 3D- und BIM-Funktionen gehören nicht zur ersten Version.

**Grundsatz:** Das persistente CAD-Dokument ist unabhängig von Paper.js, React und den Editor-Werkzeugen.

## 2. Gesamtarchitektur

```text
Symfony Backend
  ├── Projekte / Pläne / Benutzer / Berechtigungen / Editor
  ├── Dokumentversionen / Persistenz / Export
  └── REST API (JSON)
           │
           ▼
TypeScript CAD Document Model
  ├── Vertices / Elements / Layers / Groups / Styles
  ├── CAD Editor Core
  │     ├── Tools / Selection / Commands / Undo-Redo
  │     └── Snapping / Inference / Guides
  └── Paper.js Adapter
        ├── Rendering / Hit Testing
        └── Geometrie / Intersections / Bezier
           │
           ▼
       Canvas-Ansicht
       ├── View Mode
       └── Edit Mode (+ Overlays und Werkzeuge)

React: Toolbar, Properties, Layer-Panel, Dialoge und Projekt-UI
```

### Technologieauswahl

| Bereich | Technologie | Verantwortung |
| --- | --- | --- |
| Backend | Symfony / PHP | Geschäftslogik, API, Benutzer und Projekte |
| Datenbank | MySQL oder PostgreSQL | Speicherung |
| Frontend | TypeScript | CAD-Modell und Editor-Core |
| UI | React | Bedienoberfläche, Panels und Dialoge |
| Rendering und Geometrie | **Paper.js** | Canvas, Pfade, Kurven, Schnittpunkte und Hit Testing |
| Räumliche Suche | RBush (optional) | Effiziente Suche nach benachbarten Elementen |
| Snapping / Inference | Eigene TypeScript-Module | Kandidaten, Regeln, Prioritäten und Vorschläge |
| Undo / Redo | Eigener Command Manager | Nachvollziehbare Änderungen |

**Warum Paper.js statt Konva.js?** Paper.js ist stärker auf Vektorgeometrie ausgerichtet. Methoden wie `getIntersections()`, `getNearestPoint()` und native Bézier-Segmente mit Handles passen zu einem CAD-Editor. Die Interaktion und objektspezifische Bearbeitung wird bewusst selbst implementiert. Ein Proof of Concept sollte diese Wahl vor der endgültigen Festlegung validieren. Zusätzliche Bibliotheken wie FlattenJS, Maker.js oder Bezier.js sind für V1 voraussichtlich nicht erforderlich.

## 3. Backend mit Symfony

Das Backend verwaltet Projekte, Pläne, Benutzer, Berechtigungen, Versionen und später Exporte sowie zusätzliche organisatorische Funktionen.

### Fachliche Struktur

Die fachiche Struktur sollte aufgeteilt werden und alle Bereiche haben ihre Controller, Commands, Entitäten, Repositories usw.
Zum Beipsiel der Bereich Pläne enthält alle Entitäten, die zu einem Plan gehören.
Die Aufteilung Editor, stellt die API-Endpoints bereit.
Die Aufteilung User wird die Benutzerverwaltung beinhalten, die noch kommen wird.


```text
Project
  ├── Plan: Erdgeschoss
  │     ├── Version 1
  │     └── Version 2
  ├── Plan: Obergeschoss
  │     └── Version 1
  └── Plan: Schnitt A-A
        └── Version 1
```

Mögliche Doctrine-Entities:

- `Project`
- `Plan` (mit Layer, Group, ElementStyle, Vertex, Element, PolylineVertex)
- `PlanVersion` (Draft, Head und Historie eines Plans)
- `User`
- `ProjectMember`

### Dokumentpersistenz

Ursprünglich war ein versioniertes JSON-Dokument pro `PlanVersion` vorgesehen. **Entschieden ist
jetzt eine relationale Speicherung**: der Arbeitsstand eines Plans liegt als Entitäten in der
Datenbank (`Plan`, `Layer`, `Group`, `ElementStyle`, `Vertex`, `Element` mit Single Table
Inheritance pro Typ, `PolylineVertex`), entsprechend dem Dokumentmodell des Editors. Das passt zu
den Commands des Editors, die die geänderten Element-IDs liefern, und erlaubt später gezieltes
Speichern.

Die Inhalte gehören einer **`PlanVersion`**. Ein Plan hat immer einen **Draft**, an dem der Editor
arbeitet, und nach dem ersten Publish einen **Head**. Ein Publish kopiert den Draft mit allen
Inhalten (neue Ids) und macht die Kopie zum Head mit der nächsten Nummer (`Plan.version`); frühere
Heads bleiben als Historie erhalten. Kopiert wird über das Dokument: Version lesen, mit der Factory
neu aufbauen.

Die API liefert den Plan weiterhin als ein Dokument in der heutigen JSON-Form; beschrieben wird es
durch die API-Models in `src/Application/Model/Plan/`.

### REST API (erster Vorschlag)

```http
GET    /api/projects
POST   /api/projects
GET    /api/projects/{id}
GET    /api/projects/{id}/plans
GET    /api/plans/{id}
PUT    /api/plans/{id}/document
GET    /api/plans/{id}/versions
POST   /api/plans/{id}/versions
```

Bei konkurrierenden Änderungen sollte eine Revision bzw. ein ETag verwendet werden. Echtzeit-Kollaboration ist nicht Teil von V1.

## 4. Persistentes TypeScript-Datenmodell

Die folgenden Typen sind ein **Ausgangspunkt**, noch kein endgültiges Schema.

```ts
type Id = string;
type Unit = 'mm' | 'cm' | 'm';

interface Point {
    x: number;
    y: number;
}

interface Vector2 {
    x: number;
    y: number;
}

interface CadDocument {
    id: Id;
    name: string;
    schemaVersion: number;
    unit: Unit;
    vertices: Vertex[];
    elements: CadElement[];
    layers: Layer[];
    groups: Group[];
    styles: ElementStyle[];
}

interface Vertex {
    id: Id;
    x: number;
    y: number;
}

interface BaseElement {
    id: Id;
    layerId: Id | null;
    groupId: Id | null;
    styleId: Id | null;
}

interface LineElement extends BaseElement {
    type: 'line';
    startVertexId: Id;
    endVertexId: Id;
}

interface CircleElement extends BaseElement {
    type: 'circle';
    centerVertexId: Id;
    radius: number;
}

interface CubicBezierElement extends BaseElement {
    type: 'bezier';
    startVertexId: Id;
    endVertexId: Id;
    startControl: Vector2;
    endControl: Vector2;
}

interface PolylineElement extends BaseElement {
    type: 'polyline';
    vertexIds: Id[];
    closed: boolean;
}

type CadElement =
    | LineElement
    | CircleElement
    | CubicBezierElement
    | PolylineElement;

interface Layer {
    id: Id;
    name: string;
    visible: boolean;
    locked: boolean;
}

interface Group {
    id: Id;
    name: string;
}

interface ElementStyle {
    id: Id;
    name: string;
    strokeColor: string;
    strokeWidth: number;
    dashPattern: number[];
    fillColor: string | null;
}
```

### Vertices und echte Verbindungen

`Vertex` ist ein persistenter geometrischer Punkt mit eigener Identität. Mehrere Elemente können denselben Vertex referenzieren:

```ts
const lineA = {
    id: 'line-a',
    type: 'line',
    startVertexId: 'v1',
    endVertexId: 'v2',
};

const lineB = {
    id: 'line-b',
    type: 'line',
    startVertexId: 'v2',
    endVertexId: 'v3',
};
```

Wird `v2` verschoben, verändern sich beide Linien. **Ein Snap auf dieselbe Koordinate bedeutet jedoch nicht automatisch, dass beide Elemente denselben Vertex teilen.** Das aktive Werkzeug entscheidet, ob eine dauerhafte topologische Verbindung entsteht.

### Kreise

Ein Kreis speichert nur Mittelpunkt (`centerVertexId`) und Radius. Die Quadranten und sonstigen charakteristischen Snap-Punkte werden berechnet.

### Bézier-Kurven

V1 verwendet kubische Bézier-Kurven mit zwei End-Vertices und zwei **relativen** Control-Vektoren. Verschiebt sich ein Endpunkt, bewegt sich sein Control-Handle mit.

### Polylines und Gruppen

Eine Polyline ist **ein** Objekt mit geordneten Vertices. Eine Gruppe fasst dagegen **mehrere eigenständige Elemente** zusammen. Im ersten Modell besitzt ein Element höchstens eine `groupId`; die Beziehung wird nicht zusätzlich über `elementIds` in der Gruppe dupliziert.

### Was nicht gespeichert wird

Nicht persistieren, wenn eindeutig ableitbar oder rein temporär:

- Midpoints, Schnittpunkte und nächste Punkte auf Pfaden
- Kreisquadranten und Bounding Boxes
- Snap-Kandidaten und temporäre Hilfslinien
- Hover, Selection, Dragging und Editor-Handles

**Prinzip:** Speichern, was der Benutzer definiert hat; berechnen, was sich daraus ergibt.

## 5. Paper.js und die beiden Ansichtsmodi

Ein gemeinsamer `PaperRenderer` erzeugt und aktualisiert die Paper.js-Szene aus dem CAD-Modell. Eine Zuordnung `ElementId → Paper.Item` ermöglicht gezielte Updates statt vollständigem Neuaufbau bei jeder Änderung.

Beispiel:

```ts
const start = vertices[line.startVertexId];
const end = vertices[line.endVertexId];

const path = new paper.Path.Line({
    from: [start.x, start.y],
    to: [end.x, end.y],
    strokeColor: 'black',
});
```

**View Mode:** Gemeinsame Szene mit Zeichnung, Styles sowie Zoom/Pan.

**Edit Mode:** Dieselbe Renderimplementierung, zusätzlich Selection, Werkzeuge, Handles, Snapping, Inference und Editor-Overlays. Der Renderer selbst muss keine Editing-Zustände verwalten.

## 6. Editor-Core

```text
CAD Editor
├── Tool System
│   ├── SelectTool
│   ├── LineTool
│   ├── CircleTool
│   ├── BezierTool
│   ├── MoveTool
│   └── RotateTool
├── Selection Manager
├── Command Manager (Execute / Undo / Redo)
├── Geometry Service
├── Snapping Engine
├── Inference Engine
├── Spatial Index (optional)
└── Editor Overlay
    ├── Handles
    ├── Guides
    └── Snap Indicators
```

### Objektspezifische Handles

Statt eines universellen Transformers erhält jeder Objekttyp passende Bearbeitungsmöglichkeiten:

- Linie: Start- und Endpunkt
- Kreis: Mittelpunkt und Radius
- Bézier: Endpunkte und Control-Handles
- Weitere Objekte: passende Resize-/Rotate-/Edit-Handles

### Commands und Undo/Redo

Dauerhafte Modelländerungen laufen über Commands:

```ts
interface Command {
    execute(): void;
    undo(): void;
}
```

Beispiele: `MoveVertexCommand`, `CreateLineCommand`, `DeleteElementCommand`, `ConnectVerticesCommand`, `RotateElementsCommand`.

Während des Ziehens kann eine temporäre Vorschau angezeigt werden. Beim Abschluss wird idealerweise **ein** Command bzw. Undo-Schritt erzeugt.

## 7. Snapping und Inference

**Snapping:** Wählt eine präzise Einrastposition.

**Inference:** Erkennt und schlägt geometrische Beziehungen vor.

| Erkennung | Zweck |
| --- | --- |
| Endpoint | Anfang und Ende einer Linie |
| Midpoint | Linienmittelpunkt |
| Center | Kreismittelpunkt |
| Quadrant | Kreis oben/unten/links/rechts |
| Intersection | Schnittpunkt von Objekten |
| Nearest Point | Nächster Punkt auf einem Pfad |
| Horizontal / Vertical | Waagerechte/senkrechte Führung |
| Alignment | Gleiche X- oder Y-Koordinate |
| Parallel | Parallele Ausrichtung |
| Perpendicular | Rechtwinklige Ausrichtung |

Ablauf:

```text
Pointer Move
  → räumlich nahe Elemente ermitteln
  → Paper.js-Geometrieabfragen durchführen
  → Snap-Kandidaten bilden
  → Entfernung / Priorität / Werkzeugregeln auswerten
  → Position bestimmen
  → Marker und Hilfslinien anzeigen
  → beim Abschluss Command ausführen
```

Der Snap-Radius sollte sich aus Nutzersicht sinnvollerweise in **Bildschirmpixeln** verhalten. RBush kann später bei vielen Elementen die Suche beschleunigen. Die Snap-Engine liefert Kandidaten; das Werkzeug entscheidet über die tatsächlich ausgeführte Änderung und über eine mögliche Vertex-Verbindung.

## 8. Styles, Einheiten und Export

Styles enthalten Linienfarbe, Linienstärke, Strichmuster und optionale Füllung. Beispielhafte Strichmuster:

```ts
const patterns = {
    solid: [],
    dashed: [10, 5],
    dotted: [1, 4],
    dashDot: [10, 5, 1, 5],
};
```

Die Einheit und Bedeutung von Linienstärken/Strichmustern muss noch festgelegt werden: Modellkoordinaten und Papier-/Darstellungseinheiten dürfen nicht verwechselt werden. Temporäre Handles und Guides sind Editor-Darstellung, keine Dokumentstyles.

Mögliche Exporte:

```text
CAD Document
├── Paper.js → Browseransicht
├── SVG
├── PDF (maßstabsgetreu)
└── später DXF
```

Für maßstabsgetreue PDF-Ausgabe werden später Papierformat, Ausrichtung, Maßstab und gegebenenfalls Ansichtsfenster benötigt.

## 9. Vorgeschlagene Frontend-Projektstruktur

```text
src/
└── cad/
    ├── model/
    │   ├── CadDocument.ts
    │   ├── Vertex.ts
    │   ├── CadElement.ts
    │   ├── LineElement.ts
    │   ├── CircleElement.ts
    │   ├── BezierElement.ts
    │   ├── PolylineElement.ts
    │   ├── Layer.ts
    │   ├── Group.ts
    │   └── ElementStyle.ts
    ├── geometry/
    │   └── GeometryService.ts
    ├── renderer/
    │   ├── PaperRenderer.ts
    │   ├── ElementRenderer.ts
    │   └── Viewport.ts
    ├── editor/
    │   ├── CadEditor.ts
    │   ├── EditorState.ts
    │   ├── SelectionManager.ts
    │   ├── tools/
    │   │   ├── SelectTool.ts
    │   │   ├── LineTool.ts
    │   │   ├── CircleTool.ts
    │   │   ├── BezierTool.ts
    │   │   └── MoveTool.ts
    │   ├── commands/
    │   │   ├── CommandManager.ts
    │   │   ├── MoveVertexCommand.ts
    │   │   └── CreateElementCommand.ts
    │   ├── snapping/
    │   │   ├── SnapEngine.ts
    │   │   ├── SnapCandidate.ts
    │   │   └── SnapRules.ts
    │   └── overlays/
    │       ├── SelectionOverlay.ts
    │       ├── HandleOverlay.ts
    │       └── GuideOverlay.ts
    └── persistence/
        ├── CadSerializer.ts
        └── CadApiClient.ts
```

Die Struktur ist ein Zielbild, kein Auftrag, sämtliche Klassen sofort anzulegen.

## 10. Inkrementeller Entwicklungsplan

### Phase 1 – Dokumentmodell und Viewer

- TypeScript-Modelle und JSON-Serialisierung
- Paper.js-Adapter
- Linien, Kreise, Béziers, Polylines und Styles
- Zoom/Pan

**Ergebnis:** Ein gespeicherter Plan kann angezeigt werden.

### Phase 2 – Grundlegender Editor

- Auswahl und Hover
- Zeichnen, Verschieben, Löschen
- Vertex-Handles
- Commands und Undo/Redo

**Ergebnis:** Ein Plan kann erstellt und bearbeitet werden.

### Phase 3 – Geometrische Bearbeitung

- Kreismittelpunkt und Radius bearbeiten
- Bézier-Handles
- Rotation und Polylines
- Gemeinsame Vertices und deren Bearbeitungsregeln

**Ergebnis:** Geometrische Objekte lassen sich gezielt manipulieren.

### Phase 4 – Snapping

- Endpunkte, Mittelpunkte und Kreisquadranten
- Schnittpunkte
- Toleranzen und Prioritäten

**Ergebnis:** Präzises Zeichnen mit Einrastpunkten.

### Phase 5 – Inference und Guides

- Horizontal, vertikal, parallel, rechtwinklig
- X-/Y-Alignment
- Temporäre Hilfslinien und Marker

**Ergebnis:** Intelligente CAD-artige Zeichenunterstützung.

### Phase 6 – Integration und Produktfunktionen

- Symfony-Persistenz und Projektverwaltung
- Versionierung und Konflikterkennung
- Layer-Verwaltung
- Exporte, Optimierungen und Tests

**Ergebnis:** Eine zusammenhängende erste Produktversion.

Die Backend-Grundlagen sollten bereits parallel zu Phase 1 vorbereitet werden, damit API und Dokumentformat aufeinander abgestimmt sind.

## 11. Noch offene Architekturentscheidungen

1. **Koordinaten und Einheiten:** Interne Basiseinheit, numerische Genauigkeit, Maßstab, Zoom und Transformation zwischen Modell- und Bildschirmkoordinaten.
2. **Vertex-Verbindungen:** Wann wird aus einem Snap eine echte topologische Verbindung? Welche Objekte dürfen Vertices teilen, und wie wird beim Verschieben/Trennen verfahren?
3. **Transformationen und Gruppen:** Werden Rotationen/Skalierungen in Koordinaten eingerechnet oder als eigene Transformationsdaten gespeichert? Wie verhalten sich verschachtelte Gruppen?
4. **Dokumentversionierung:** Schema-Migrationen, Validierung, Revisionsnummern und Konflikterkennung.
5. **Styles und Druck:** Modell- vs. Papiereinheiten, maßstabsgetreue Linienstärken und Exportlayout.

Insbesondere die Vertex-Regeln und das Transformationsmodell sollten vor komplexeren Editing-Tools festgelegt werden.

## 12. Einsatz von Claude Code

Claude Code soll vor allem für **kleine, klar spezifizierte Aufgaben** eingesetzt werden. Zuerst werden Datenmodell, Modulgrenzen, Commands und Interaktionsregeln definiert. Danach lassen sich Features inkrementell umsetzen und testen.

Beispiel für eine gut abgegrenzte Aufgabe:

> Implementiere einen `CircleEditor` nach den bestehenden Konventionen des `LineEditor`. Er bietet Center- und Radius-Handles, nutzt dieselbe Pointer-State-Machine und verändert das persistente CAD-Modell ausschließlich über Commands.

Damit bleibt die Architektur konsistent, statt durch viele unabhängig generierte Einzellösungen zu wachsen.

## 13. Zusammenfassung der Leitentscheidungen

- **Symfony** verwaltet Projekte, Pläne, Berechtigungen, Versionen und Persistenz.
- **Ein eigenes TypeScript-CAD-Modell** ist die dauerhafte, renderer-unabhängige Datenbasis.
- **Paper.js** übernimmt Rendering, Hit Testing und grundlegende Vektorgeometrie.
- **Ein gemeinsamer Renderer** wird im View Mode und Edit Mode verwendet.
- **Der Editor-Core** enthält Werkzeuge, Commands, Snapping, Inference und objektspezifische Handles.
- **React** bildet die Benutzeroberfläche um den CAD-Canvas.
- **Kleine Entwicklungsphasen** liefern früh einen nutzbaren Viewer und erweitern ihn schrittweise zum Editor.

**Ziel:** Eine solide, schlanke 2D-Zeichenplattform, die sich ohne unnötige Vorabkomplexität zu einer anwenderfreundlichen CAD-Anwendung weiterentwickeln lässt.

## Architektur im Backend
Es die Applikation im Backend sollte als QCRS-Architektur umgesetzt werden nach diesem Vorbild:
https://dev.to/igornosatov_15/cqrs-pattern-in-symfony-295