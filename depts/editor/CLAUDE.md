# CLAUDE.md – CAD editor

Guidance for work in `depts/editor/`. The repository-wide rules (Docker, backend, workflow) are
in the root `CLAUDE.md`.

## What this is

The CAD editor frontend: Vite + React 19 + TypeScript, Paper.js for rendering, Redux Toolkit
installed (unused). **It is being rebuilt from scratch, closer to AutoCAD behaviour**, in small
steps. So far it loads a plan through the API and displays it (wheel zoom, middle/Space+drag
pan, status line, light/dark mode), has AutoCAD-like object selection, a grid, a UCS icon,
object snap, polar tracking, Ortho, object snap tracking, Dynamic Input, the commands LINIE,
PLINIE (straight segments only), KREIS, ELLIPSE, RECHTECK and SCHIEBEN with preview, typed
coordinates and undo/redo. Changes are not saved to the backend yet; grips are drawn but have
no function.

**How it behaves for the user is in `docs/bedienung.md`** (German, every mouse and keyboard
action, per command and mode). Read it before changing an interaction; it is the reference for
prompts, options and keys, which this file does not repeat. Specs per feature (AutoCAD
behaviour) are in `docs/specs/`, what is left of a feature in `docs/todo/`.

### Keeping `docs/bedienung.md` in sync

Update it whenever the controls change. It never states values from
`src/settings/editorSettings.ts` (defaults, start states, colours, px sizes): it names the
setting instead (e.g. "Einstellung `apertureSize`"), so they are kept in one place. New settings
get a row (name, meaning, AutoCAD) in its "Einstellungen" table, without a value. The same goes
for fixed constants in the code (thresholds, tolerances, limits): name the constant and its
file (e.g. "`TIE_TOLERANCE_PX` in `src/cad/editor/snapping/SnapEngine.ts`") instead of its
value; renaming or moving such a constant means updating the guide.

### Reference material (read, don't copy)

- **`depts/editor-old/`**: the previous implementation (viewer, `CadEditor`, commands,
  selection, handles, `PaperRenderer`, serializer, `CadApiClient`, tests). For comparison only,
  never imported. Parts that fit may be adopted (reviewed, trimmed to the current step, with
  their tests), but not wholesale: its interaction model (selection, handles, tools) differs
  from AutoCAD. Already adopted: the document model (with `circle`), serializer, API client,
  `Viewport`, `PathSpec`, arc geometry, `PaperRenderer` (with items map and overlay layer), the
  canvas input routing, the highlight-by-restyled-copy overlay and `selectionUnit` (group
  expansion). Once adopted, the code here is the reference.
- **`depts/demo1/`** (git-ignored): a plain-JS object snap (OSNAP) reference with tests.
  `Snap-Spezifikation.md` is the detailed snap/tracking/MOVE spec (German, AutoCAD behaviour).
  Run with `npm run demo:dev` in `depts/demo1/`, then open http://localhost:3000/demo/. Use it
  to cross-check our logic, not as a template; ideas may be adopted (the `rbush` spatial index
  already is), always re-implemented as typed code in our structure, never copied or imported.

## Running it

**Node tooling runs on the host**, inside `depts/editor/`: `npm run dev`, `npm run build`
(`tsc -b && vite build`), `npm run lint` (oxlint), `npm test` (Vitest; `*.test.ts` next to the
sources, pure code only, no canvas), `npm run generate:api` (see the root `CLAUDE.md`, "API
documentation"). The `editor` container only serves Vite (http://localhost:8081, it runs
`npm run dev:init`). It has its own named volume over `/app/node_modules`, because rolldown,
Vitest and oxlint ship platform-specific native bindings (macOS on the host, Linux musl in the
container): after a dependency change, run `npm install` on the host and
`docker compose restart editor`. `.npmrc` sets `cache=node_modules/.npm-cache`, so npm writes
nothing to `~/.npm`; never install packages globally. The same holds for `depts/editor-old/`.

Vite proxies `/api` to `http://nginx` (same origin, no CORS); for `npm run dev` on the host set
`API_PROXY_TARGET=http://localhost:8080`. In dev the editor loads the plan
`01994f4e-6f3a-7c2d-9b1e-5a3c2d1e0f42` when the URL names none (`DEV_PLAN_ID` in `App.tsx`,
`?plan=<id>` names another). `src/cad/__fixtures__/sample-plan.json` (unit tests) must stay
byte-identical to the backend's `fixtures/plans/sample-plan.json`; readable names of its ids in
`sampleIds.ts`. `app/*` is a Vite alias for `src/*`. Model coordinates are **mm with Y up**; the
viewport flips Y for the screen.

## Architecture

- **The document model is independent of Paper.js, React and the tools.** A custom TypeScript
  model (vertices, elements, layers, groups, styles) is the source of truth. Store what the
  user defined; compute what can be derived (midpoints, intersections, bounding boxes, snap
  candidates, selection/hover state are never saved). The API types meet it at `CadApiClient`
  (see the root `CLAUDE.md`).
- **Layering:** document model → editor core (tools, selection, command history, snapping,
  tracking, overlays) → Paper.js adapter (`PaperRenderer` keeps an `ElementId → paper.Item`
  map for incremental updates). One renderer serves View and Edit mode; Edit mode adds overlays
  on top, and the renderer holds no editing state.
- **Every persistent model change goes through a command** (`execute()`/`undo()`). A drag or
  a tool shows a temporary preview and then commits one command (one undo step). Each element
  type gets its own handles (line: endpoints; circle: centre and radius; Bézier: endpoints and
  control handles), not a generic transformer.
- **React is only the UI around the canvas** (toolbar, properties, layer panel, dialogs).
- Target layout `src/cad/{model,geometry,renderer,editor/{tools,commands,snapping,overlays},persistence}`:
  a target, not a mandate to scaffold everything up front.

## Interaction model (decisions and deviations)

The behaviour itself is in `docs/bedienung.md`; these are the decisions code must keep.

- **Selection** follows AutoCAD with deliberately chosen settings: a rectangle only comes from
  press + drag in empty space, a plain click into empty space does nothing; after the release
  the rectangle stays open (zoom and pan still work) until the next click or Enter; the lasso
  needs Alt (⌥) on the press. Noun-verb (pickfirst) and verb-noun ("Objekte wählen:", kept as
  `previous`) both work. Only outlines are hit, never fills; hidden or locked layers are not
  selectable; picking a grouped element picks its group (`selection/grouping.ts`, `expandToUnits`).
- **Commands** start from `ui/ToolPanel.tsx` (icons from `ui/ToolIcon.tsx`; another tool
  cancels the running command, the same one does nothing) or by name/alias at "Befehl:"
  (`SelectionEditor.startCommand`); Enter with nothing typed repeats the last command.
  **Right click acts like Enter** everywhere (no context menus yet; tools have no right-click
  hook of their own); ignored while a rectangle or lasso is open or dragged.
- **Keys:** the editor gets the keys, no focus needed; at a point prompt every printable key is
  taken (`canvasInput` prevents its default, App's shortcuts skip `defaultPrevented` keys),
  Ctrl/⌘ shortcuts are not (`EditorKeyEvent.ctrlKey`; AltGr counts as typing). Esc drops typed
  text first and only then cancels.
- **Typed input** (`cad/editor/commandInput.ts`: `parsePointInput`, `resolvePointInput`,
  `matchesKeyword`): `x,y`, `#x,y`, `d<a`, `@dx,dy`, `@d<a`, `@`, direct distance entry; degrees
  counter-clockwise from +X; LASTPOINT starts at 0,0. A keyword matches from its first capital
  on or whole (`sehnenLänge` → `L`); options that would clash (KREIS `3P`/`2P`) are compared
  whole.
- **Cursor per prompt** like AutoCAD: crosshair + pick box without a command, only the pick box
  at "Objekte wählen:", only the crosshair at point prompts (aperture box only with
  `showApertureBox`).
- **Object snap** (`cad/editor/snapping/`): END, MID, CEN, GCE, QUA, INT on the exact geometry
  (bezier midpoint by arc length; intersections exact for segments/circles/arcs, Newton-refined
  for beziers and ellipses). Only points inside the aperture box snap. A centre (and GCE, the
  area centroid of a closed polyline with ≥ 3 vertices) snaps only near the centre and only
  after its curve was passed over in this prompt (`SnapMemory`), never from the curve: a remote
  centre pulled the snap away from the quadrants. Nearest wins, ties within `TIE_TOLERANCE_PX`
  go END > INT > CEN > MID > QUA > GCE; coinciding points merge; hidden layers do not snap,
  locked ones do. Hysteresis and Tab cycling (`candidates`, bands by mode) as in the guide.
- **Snap point preview** (setting `snapPreview`) is **a deliberate deviation from AutoCAD**:
  markers for all snap points of the object under the aperture, or of the innermost closed
  element the cursor came in over (`SnapEngine.previewPoints`, cached per element).
- **Polar tracking** (`cad/editor/tracking/PolarTracking.ts`), **Ortho** (`tracking/ortho.ts`)
  and **object snap tracking** (`tracking/ObjectSnapTracking.ts`) apply where no snap point is
  found. Precedence: snap > OTRACK crossing > nearer of single tracking path and polar path
  (`polarWins`) > Ortho; typed coordinates win over all. Ortho and POLAR exclude each other
  (`TrackingModes`, `withOrtho`/`withPolar`); Shift switches Ortho over for the moment
  (`SelectionEditor.orthoActive()` = `ortho !== shiftHeld`, settings unchanged). Polar applies
  at the second point (from the base point) and at `next`/`distance` prompts; acquired OTRACK
  points hold for one point prompt. Relative-to-last-segment angles are not built yet.
- **Dynamic Input** (`cad/editor/dynamicInput.ts`, display `ui/DynamicInputLayer.ts`): at a
  prompt with fields the keys go into `DynamicInputState` instead of `input`; typed numbers bind
  the tracked point at once (`dynamicPoint`, applied in `pointAt`, so preview, rubber band,
  click and Enter agree); non-numeric text goes to `submitText` as if typed at the command line.
- **Grid** (`cad/renderer/grid.ts`, `ui/GridLayer.ts`) and **UCS icon**
  (`cad/renderer/ucsIcon.ts`, `ui/UcsIcon.ts`) are display only, on layers of their own, never
  in the document, the bounds, picking or snapping. There is only the WCS (no custom UCS).

## Commands (tools)

Each command is a state machine in `cad/editor/tools/` behind `EditorTool`; names and aliases
come from `cad/editor/commandAliases.json` (see Translations). Prompts, options and messages
are in the guide and the translation files.

| Command (id) | Tool | Result |
|---|---|---|
| SCHIEBEN (`MOVE`) | `MoveTool` | `MoveCommand` (zero displacement does nothing); vertices shared with elements that are not moved are detached (the neighbours keep a copy at the old position), like AutoCAD MOVE |
| LINIE (`LINE`) | `LineTool` | an `AddLineCommand` per point at once (drawn and snappable); "Zurück" = `DocumentHistory.revertLast`; the run becomes one undo step (`combineLast` → `CompositeCommand`) |
| PLINIE (`PLINE`) | `PolylineTool` | points stay in the tool (not snappable, like AutoCAD); one `AddPolylineCommand` when the command ends in any way, Esc and another tool included |
| KREIS (`CIRCLE`) | `CircleTool` | `AddCircleCommand` as the step's command (`geometry/circle.ts`: `circleThrough`, `circleOnDiameter`) |
| ELLIPSE (`ELLIPSE`) | `EllipseTool` | `AddEllipseCommand`; the first axis stays `radiusX` at its angle even when it is the minor one; `rotation` optional (missing = 0) |
| RECHTECK (`RECTANG`) | `RectangleTool` | `AddPolylineCommand` (closed, label `RECTANG`), corners by `rectangleCorners` |

LINIE and PLINIE remember their last vertex in the core's `DrawingMemory`
(`tools/DrawingMemory.ts`, `continuePoint`), so Enter at the first point continues from it.
New elements get their own vertices and no layer/group/style yet. What each command still
lacks is in `docs/todo/*_NotImplemented.md` (PLINE arcs with a proposed `bulges` schema in
`Polyline_Draw_NotImplemented.md`), further shortcuts in `docs/todo/Zeichnen_Tastenkuerzel.md`.

## Structure

All pure TS and unit-tested unless noted.

- `cad/editor/SelectionEditor.ts`: the editor core, independent of Paper.js and React: the
  selection, a command's object selection and all point prompt machinery (snap, Tab, polar,
  Ortho, OTRACK, Dynamic Input, typed input, LASTPOINT). It gets `EditorPointerEvent`s and key
  events and publishes an immutable `SelectionSnapshot` (prompt, typed input, message, hovered,
  highlighted, grips, area, cursor mode, snap, Tab position, snap preview, polar track,
  acquired points, object snap track, `from`, `preview`, preview point, Dynamic Input fields,
  can undo/redo) via `subscribe()`. It holds the Tab cycle state and the acquire timer; the
  engines stay stateless. It runs on a `DocumentHistory`; `newTool` creates the tools.
- `cad/editor/tools/`: `EditorTool` (`EditorTool.ts`): the tool sets its `prompt` (`select`, or
  `point` with `input` `point` | `next` (measured from `from`: polar, Ortho, direct distance,
  `@`, DYN dimension) | `vector` | `distance` (from `from` like `next`, but the tool gets
  `distance()`: a typed number as is, or the distance to a point given)), gets the selected
  objects, points, distances and option text (`''` = Enter or right click), and returns a
  `ToolStep` (`done`, `message`, a `DocumentCommand` to run after the end). A new prompt object
  starts a new point prompt. Previews are `ToolPreview`s (`polyline`, `curve` with a
  `PreviewCurve` and optional `rubberBand`, `direction` for PLINIE's length option).
- `cad/editor/commands/`: `DocumentCommand` (`execute`/`undo` on immutable documents, returning
  the new document and the changed element ids), `DocumentHistory` (current document, undo/redo
  stacks, listeners, `revertLast`, `combineLast`), `MoveCommand`, `AddLineCommand`,
  `AddPolylineCommand` (its `label` names the command), `AddCircleCommand`, `AddEllipseCommand`,
  `CompositeCommand`. `CadCanvas` keeps the history of the loaded document; the editor and the
  renderer follow it (`PaperRenderer.updateElements` replaces only the changed items,
  subscribed before the editor so its overlay sees the new paths). The editor's derived
  structures are rebuilt as a whole on every change for now.
- `cad/editor/tracking/`: `PolarTracking.ts` (`polarAngles`, `nearestRay`, `findPolarTrack`,
  `parseAngleList`/`formatAngleList`), `ObjectSnapTracking.ts` (`toggleAcquired`,
  `trackingAngles`, `findObjectTrack`, `polarWins`), `ortho.ts` (`orthoPoint`); pure and
  stateless, the editor keeps the previous track for the hysteresis.
- `cad/editor/snapping/`: `SnapMode` (modes, German labels, precedence), `SnapGeometry` (exact
  snap primitives per element; snap points of a whole element, so far only GCE, as
  `ElementSnapPoint`), `intersections`, `SnapEngine` (`candidates(query, SnapMemory, previous)`:
  all points in the aperture best first; `find` takes the first). Uses the generic `ShapeIndex`.
- `cad/editor/selection/`: `ElementShapes` (flattened outlines), `ShapeIndex` (`rbush` R-tree
  over their bounds), `picking` (point/window/crossing/lasso), `grips`, `grouping`. Like the
  snap structures, derived from the document and rebuilt after every change.
- `cad/editor/dynamicInput.ts`: `dynamicLayout` (which fields where), `DynamicInputState`,
  `trackedPointAt` (live values), `dynamicPoint`, `dynamicText` (echo on the command line).
- `cad/renderer/grid.ts` (`gridStep`: adaptive step `spacing × majorEvery^k`, `gridLines`: only
  the visible lines; `parseGridSpacing`, `parseMajorEvery`), `cad/renderer/ucsIcon.ts`
  (`ucsIconExtent`, `ucsIconPosition`).
- `cad/geometry/`: `bezier`, `intersect`, `arc.angleOnArc`, `polygon.polygonCentroid`,
  `ellipse` (rotated ellipses), `circle`. `cad/model/drawOrder.ts` gives the renderer's element
  order for selection and snapping.
- `cad/editor/overlays/SelectionOverlay.ts` (Paper.js): hover/selection highlights as restyled
  copies of the rendered paths, grips (beziers also get a dashed control frame), rectangle/
  lasso, the move preview (offset copies, originals dimmed by `PaperRenderer.setDimmed`), the
  tool previews (`PathSpec.ellipsePathSpec`, closed path for a polygon), one palette per theme.
- `ui/canvasInput.ts`: the single owner of canvas input (zoom, pan, forwarding to the editor,
  pointer capture, lost-release and `pointercancel` handling, Shift state via
  `InputTarget.setShiftHeld`) and of the cursor. `ui/CommandLine.tsx` is display only.
- `ui/SnapMarker.ts`: SVG/DOM layer over the canvas, positioned by `CadCanvas` in view px: snap
  marker, tooltip (flips at the canvas edge), tracking paths (`showTracking`), acquired points,
  rubber band (above the tracking paths), snap point preview, base point cross. `CadCanvas` also
  draws the Dynamic Input panel or dimension. `ui/StatusBar.tsx`: RASTER, ORTHO, POLAR, OFANG,
  OTRACK and DYN switches on the left, position and zoom on the right (so the switches never
  move).
- `ui/CrosshairCursor.ts`: the system pointer is hidden over the canvas; an AutoCAD-like
  crosshair as a DOM layer moved by CSS transform (the drawing is never redrawn for it), pick
  box in its centre, a minus sign while Shift is held; the grab hand while panning.

## Settings

`src/settings/editorSettings.ts` (`EditorSettings`, `DEFAULT_EDITOR_SETTINGS`) holds the
AutoCAD-like system variables (`crosshairSize` ~ CURSORSIZE, `pickboxSize` ~ PICKBOX and the
hover/click tolerance, `apertureSize` ~ APERTURE, `showApertureBox` ~ APBOX, `snapMarkerSize`
~ AUTOSNAPSIZE, `snapMarker`/`snapTooltip`/`snapMagnet` ~ AUTOSNAP, `polarTolerance` (also for
OTRACK), `trackingAcquireDelay`, `snapPreview`, `previewColor` and `gridColor` per theme,
`gridMinSpacing`, `ucsIcon…` ~ UCSICON). Code receives the object (App → `CadCanvas` → editor
and crosshair) rather than importing the defaults, so the user can change them later; for now
they are read when a document is loaded. The switches live in App state and may change at any
time: `SnapSettings` (F3, OSMODE), `TrackingModes` (Ortho F8, `PolarSettings` F10),
`ObjectTrackingSettings` (F11), `DynamicInputSettings` (F12), `GridSettings` (F7).

## Translations, theme

- German and English with i18next (`src/i18n/i18n.ts`, one instance, also used outside React:
  `t` in the editor core and the DOM layers). Texts in `src/i18n/locales/de.ts` (the reference;
  its type `Translations` types the keys) and `en.ts` (typed as `Translations`, so a missing
  key fails `tsc`); command line texts follow the German resp. English AutoCAD. **Never
  hard-code visible text.** `SelectionEditor` keeps messages as thunks and translates them when
  it builds a snapshot; `CadCanvas` calls `refreshTexts()` on `languageChanged`. Command names
  are not in the translation files: `cad/editor/commandAliases.json` maps each English AutoCAD
  name (the command id, `EditorCommand`) to its aliases, the first being the German name
  (`commandNames.ts`: `commandName`, `findCommand`; a name wins over an alias); prompts take it
  as `{{command}}`. Tests run in German (`src/i18n/testSetup.ts`).
- Light/dark mode: `ui/theme.ts` (`system`/`light`/`dark`, `data-theme` on `<html>` for the CSS
  tokens in `index.css`). Drawing colours are adapted for display only in
  `cad/renderer/displayColor.ts`; the stored document is never changed. `DARK_CANVAS_BG` there
  must match `--canvas-bg` in `index.css`. Overlay colours are tokens (`--crosshair`,
  `--snap-marker`, `--polar-track`, `--preview-color`, `--dyn-*`, `--ucs-icon` …).
