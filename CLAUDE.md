# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- BEGIN AI_MATE_AGENTS_IMPORT -->
@AGENTS.md
<!-- END AI_MATE_AGENTS_IMPORT -->

## What this is

WebCAD: a browser-based 2D CAD editor for architects, with project management. Two
apps in one repo:

- **Symfony 8.1 backend** (PHP ≥ 8.5) at the repo root: projects, plans, users,
  permissions, document versions, export. Doctrine ORM, Messenger, Security, Twig,
  AssetMapper and Stimulus are installed. Today it is still mostly skeleton
  (`IndexController` at `/index` plus one test).
- **CAD editor frontend** in `depts/editor/`: Vite + React 19 + TypeScript, with
  Paper.js for rendering and Redux Toolkit installed (unused). **The editor is being
  rebuilt from scratch, closer to AutoCAD behaviour.** Everything is rebuilt in small
  steps. So far it loads a plan through the API and displays it (wheel zoom,
  middle/Space+drag pan, status line, light/dark mode), has AutoCAD-like object
  selection, a grid, object snap, polar tracking and the MOVE command (`SCHIEBEN`) with preview,
  typed coordinates and undo/redo (see "Editor: current state" below). Changes are not saved to the backend yet; grips
  are drawn but have no function.

### Reference material (read, don't copy)

- **`depts/editor-old/`**: the previous implementation (viewer, `CadEditor`,
  commands, selection, handles, `PaperRenderer`, serializer, `CadApiClient`, tests).
  It is for comparison only and is never imported. Parts that fit the new editor may be
  adopted into `depts/editor/` (reviewed, trimmed to the current step, with their tests),
  but not wholesale: its interaction model (selection, handles, tools) differs from
  AutoCAD. Already adopted: the document model (with `circle`), serializer, API client,
  `Viewport`, `PathSpec`, arc geometry, `PaperRenderer` (with items map and overlay
  layer), the canvas input routing, the highlight-by-restyled-copy overlay and
  `selectionUnit` (group expansion). Once adopted, the code in `depts/editor/` is the
  reference.
- **`depts/demo1/`** (git-ignored): a plain-JS object snap (OSNAP) reference with tests.
  `Snap-Spezifikation.md` is the detailed snap/tracking/MOVE spec (German, AutoCAD
  behaviour). Run with `npm run demo:dev` in `depts/demo1/`, then open
  http://localhost:3000/demo/. Use it to cross-check our logic, not as a template; ideas
  may be adopted (the `rbush` spatial index already is). It is for comparison only: the editor is
  TypeScript, so re-implement ideas as typed code in our structure and never copy or
  import demo1's JS files.
- **`docs/`**: `docs/todo/setup.md` (architecture concept, German) and
  `docs/architecture/cqrs.md`.
- **`depts/editor/docs/bedienung.md`**: user guide of the new editor (German), covering
  every mouse and keyboard action. Keep it in sync when the controls change.

## Running it (Docker)

Everything runs through `compose.yml`. Run PHP tooling inside the `php` container, not
on the host. This overrides the `symfony serve -d` advice in AGENTS.md.

```sh
docker compose up -d
docker compose exec php bin/console <cmd>          # e.g. debug:router, make:*, doctrine:migrations:migrate
docker compose exec php bin/phpunit                # all tests
docker compose exec php bin/phpunit --filter testIndex tests/Controller/IndexControllerTest.php
docker compose exec php vendor/bin/php-cs-fixer fix   # @Symfony ruleset (php-cs-fixer/shim)
docker compose exec -T php vendor/bin/mate tools:list # AI Mate diagnostics; always run Mate this way
```

| Service    | URL / port                                                          |
|------------|---------------------------------------------------------------------|
| App        | http://localhost:8080 (nginx → php-fpm, document root `public/`)     |
| Editor dev | http://localhost:8081 (Vite; the `editor` container runs `npm run dev:init`) |
| Old editor | http://localhost:8082 (`editor-old` container, reference only)         |
| Mailpit    | http://localhost:8025 (SMTP on 1025)                                 |
| phpMyAdmin | http://localhost:8210                                               |

The DB container is **MySQL 8.0** (`app`/`app`, database `app`). `.env`'s
`DATABASE_URL` points at it via the compose host `db`, so it only resolves inside the
containers.

PHPUnit runs with `failOnDeprecation`, `failOnNotice` and `failOnWarning`, so a
deprecation fails the suite.

Editor commands (from `depts/editor/`): `npm run dev`, `npm run build` (`tsc -b && vite build`),
`npm run lint` (oxlint), `npm test` (Vitest; `*.test.ts` next to sources, pure code
only, no canvas). Model coordinates are **mm with Y up**; the viewport flips Y for the screen.

Vite proxies `/api` to `http://nginx` (same origin, no CORS). When running `npm run dev`
on the host, set `API_PROXY_TARGET=http://localhost:8080`.

`GET /api/plans/{id}/document` returns the raw document JSON with the revision as `ETag`.
For now `GetPlanDocumentHandler` reads `fixtures/plans/{uuid}.json` instead of the DB, and
only that handler gets replaced once `PlanVersion` exists. The same sample plan exists
twice, as `fixtures/plans/01994f4e-….json` (backend) and
`depts/editor/src/cad/__fixtures__/sample-plan.json` (frontend unit tests), because the
`php` container cannot see `depts/`. Keep them byte-identical. Ids are numbered fixture
UUIDs `00000000-0000-7000-8000-000000000NNN` (vertices 001+, elements 101+, layers 201+,
groups 301+, styles 401+); readable names live in `name` and in `sampleIds.ts`. The plan
contains every element type (line, polyline, arc, circle, ellipse, bezier).

The `php` container mounts a named volume over `/app/depts`, so the editor sources are not
visible from inside `php`.

**Node tooling runs on the host** (`npm install`, `npm test`, `npm run lint|build`, run
inside `depts/editor/` or `depts/editor-old/`). The `editor`/`editor-old` containers only
serve Vite. Each container has its own named volume over `/app/node_modules`, because
rolldown, Vitest and oxlint ship platform-specific native bindings (macOS on the host,
Linux musl in the container). After a dependency change, run `npm install` on the host
and `docker compose restart editor`. Each editor has an `.npmrc` with
`cache=node_modules/.npm-cache`, so npm writes nothing to `~/.npm`; never install
packages globally.

## Architecture

The design concept is in `docs/todo/setup.md` (German). Its main
decisions (still valid for the rebuild):

- **The persisted CAD document is independent of Paper.js, React and the editor tools.**
  A custom TypeScript model (vertices, elements, layers, groups, styles) is the source
  of truth. Store what the user defined; compute what can be derived (midpoints,
  intersections, bounding boxes, snap candidates, selection/hover state are never saved).
- **Layering in the editor:** TS document model → editor core (tools, selection,
  command manager with undo/redo, snapping, inference, overlays) → Paper.js adapter
  (`PaperRenderer` keeps an `ElementId → paper.Item` map for incremental updates).
  One renderer serves both View mode and Edit mode; Edit mode adds overlays on top,
  and the renderer itself holds no editing state.
- **Every persistent model change goes through a Command** (`execute()`/`undo()`).
  A drag shows a temporary preview and then commits a single command (one undo step).
  Each element type gets its own handles (line: endpoints; circle: center and radius;
  Bézier: endpoints and control handles), not a generic transformer.
- **React is only the UI around the canvas** (toolbar, properties, layer panel, dialogs).
- Target frontend layout is `src/cad/{model,geometry,renderer,editor/{tools,commands,snapping,overlays},persistence}`.
  It is a target, not a mandate to scaffold everything up front. `app/*` is a Vite
  alias for `depts/editor/src/*`.
- **Backend persistence:** a plan's drawing is stored as a **versioned JSON document**
  (`PlanVersion.documentData`), not one entity per line or vertex. Planned entities:
  `Project`, `Plan`, `PlanVersion`, `User`, `ProjectMember`. Planned REST API under
  `/api/projects` and `/api/plans/{id}/document|versions`, with revision/ETag-based
  conflict detection. Real-time collaboration is out of scope for V1.
- **Backend uses CQRS** following `docs/architecture/cqrs.md`: `App\Application\{Command,
  CommandHandler,Query,QueryHandler,DTO}`, `App\Domain\{Entity,Event}`,
  `App\Infrastructure\…`, with separate Messenger `command.bus` / `query.bus`. Queries
  return DTOs and never modify state. Name commands after business tasks, not field
  setters. Both buses are configured in `config/packages/messenger.yaml`, and both are
  synchronous for now (no async transport or worker yet). Pin each handler to its bus
  with `#[AsMessageHandler(bus: 'command.bus'|'query.bus')]`. Command handlers only
  `persist()`, because the `doctrine_transaction` middleware flushes and commits. Query
  handlers read with DBAL and return DTOs. Doctrine maps entities from
  `src/Domain/Entity`, not `src/Entity`. The reference example is
  `CreateProjectCommand`/`GetProjectQuery`, tested in `tests/Application/ProjectCqrsTest.php`.
- **Test DB:** `app_test`. After a new migration, run
  `docker compose exec php bin/console doctrine:migrations:migrate -n --env=test`.
- The editor build writes `editor/[name].js` without hashes, because Symfony
  (AssetMapper) is meant to handle cache-busting. Integration of the built editor into
  Twig is not wired up yet.

Still open, to be decided before building complex editing tools: coordinate units and
precision, when a snap becomes a real shared-vertex connection, how transforms and
groups are stored, and document schema versioning/migrations.

Work in small, well-scoped increments that follow existing conventions (e.g. "build a
`CircleEditor` like the `LineEditor`, mutating the model only via commands").

## Editor: current state

Object selection follows AutoCAD, with these settings deliberately chosen: **a rectangle
only comes from press + drag in empty space; a plain click into empty space does
nothing.** After the release the rectangle **stays open** (the view can still be zoomed and
panned) until the next click sets its opposite corner or Enter ends it at the cursor; Esc
drops it. The **lasso needs Alt (⌥) held on the press** and ends on release. Otherwise:

- No command active (noun-verb): click adds to the pickfirst selection (highlight +
  grips), Shift removes, Esc clears. Rectangle to the right = window (completely inside),
  to the left = crossing (touches); lasso direction picks the mode, Space toggles.
- Toolbar tool "Verschieben" starts `SCHIEBEN` (AutoCAD MOVE, id `MOVE`); so does typing
  `SCHIEBEN` or `MOVE` (any case, either language) at "Befehl:" with Enter or Space (Esc and
  Backspace edit the text; Space/Enter/Esc keep their meaning while nothing is typed;
  otherwise "Unbekannter Befehl "XYZ"."; no typing while a rectangle or lasso is open). With a pickfirst selection
  it goes straight to "Basispunkt angeben oder [Verschiebung] <Verschiebung>:" ("N gefunden"); otherwise it first asks
  "Objekte wählen:" (verb-noun: grips disappear, AutoCAD-style counts such as "1 gefunden,
  2 gesamt"), and Enter or right click ends the selection (kept as `previous`; empty ends
  the command). The base point and then the second point are clicked with object snap (or
  typed, see below). At the
  second point a preview follows the cursor (or its snap point): copies of the
  selected paths in their own style (opacity 0.7), offset by (point − base point), and a
  dashed rubber band from the base point (orange on light, yellow on dark); the originals
  stay in place dimmed to a neutral grey (`PaperRenderer.setDimmed`, display only) and
  stay snappable, the document is unchanged.
  The second click moves the selection by (point − base point) as one undo step
  (`MoveCommand`; a zero displacement does nothing) and ends the command with nothing
  selected. Vertices shared with elements that are not moved are detached: those
  neighbours get one copy of the vertex at the old position and stay unchanged, like
  AutoCAD MOVE. Undo/redo with no command running: toolbar "Rückgängig"/"Wiederherstellen",
  Ctrl/⌘+Z, Ctrl+Y or ⌘+⇧+Z (command line "Rückgängig: SCHIEBEN"). Right click does
  nothing at the point prompts yet. Esc cancels at every prompt. The selection stays
  highlighted at the point prompts, without rollover; the base point shows as a small cross.
- Typed input at the point prompts (no focus needed; the command line shows the text and a
  caret): absolute `x,y` (also `#x,y`) and `abstand<winkel`, relative `@dx,dy`,
  `@abstand<winkel` and `@` (to the base point at the second point; to the last point
  given, AutoCAD's LASTPOINT starting at 0,0, at the base point), `.` decimals, degrees
  counter-clockwise from +X (Y up). A plain number at the second point is direct distance
  entry towards the preview point (cursor or snap point). Enter (or Space once something is
  typed) ends the text, Backspace edits, Esc drops the text and only then cancels; a click
  drops it. Enter empty or "V" at the base point asks "Verschiebung angeben <0,0>:" (typed
  vector, or a clicked point as vector; Enter empty = 0,0, nothing moves); Enter empty at
  the second point moves by the base point as vector. Invalid text: "Punkt oder
  Option-Schlüsselwort erforderlich.", the prompt stays. Every printable key is taken at a
  point prompt (`canvasInput` prevents its default; App's shortcuts skip `defaultPrevented`
  keys), Ctrl/⌘ shortcuts are not (`EditorKeyEvent.ctrlKey`; AltGr counts as typing).
- Cursor per prompt like AutoCAD: crosshair + pick box with no command, only the pick box
  at "Objekte wählen:", only the crosshair at point prompts (the aperture box only with
  `showApertureBox`).
- Object snap (AutoSnap): endpoint, midpoint, centre, geometric centre, quadrant,
  intersection, on the exact geometry (bezier midpoint by arc length; intersections exact for segments/circles/arcs,
  numeric with Newton refinement for beziers and ellipses). Points must lie in the
  aperture box (`apertureSize` px, square); a point outside never snaps. A centre snaps
  only near the centre and only after its curve was passed over in this point prompt; it is
  deliberately never offered from the curve (a remote centre pulled the snap away from the
  quadrants the user aimed at). The geometric centre (GCE, off by default like in AutoCAD) is
  the area centroid (shoelace, `geometry/polygon.ts`; centre of the bounds without area) of a
  closed polyline with at least three vertices and snaps under the same rule as a centre.
  Then nearest, with a 2 px tie going END > INT > CEN > MID > QUA > GCE; coinciding points
  merge. Hidden layers do not snap, locked ones do. Marker (green,
  shape per mode), tooltip and magnet (the crosshair and the status bar coordinates jump to
  the snap point). Status bar "OFANG" switch (also F3) with a menu of the modes.
  Snap point preview, **a deliberate deviation from AutoCAD** (setting `snapPreview`, on by
  default): at every point prompt, while the outline of an object passes through the
  aperture, small markers in the mode shapes show all its snap points in the enabled modes,
  wherever they lie (endpoints, midpoints, centre, geometric centre, quadrants and its
  intersections with all other objects; `SnapEngine.previewPoints`, cached per element); where no outline passes
  through the aperture, those of the innermost closed element around the cursor (smallest
  enclosed area, e.g. the table rather than the rug under it) whose outline the aperture
  touched in this point prompt (`SnapMemory` records every touched outline; CEN and GCE use
  it too), so the cursor must come in over the line, in `previewColor` (the
  rubber band's colour). They have no function; the point that snaps now is left out (the
  green marker shows it). None with F3 off; hidden layers are skipped like the snap does.
  Hysteresis: the last snap point stays while it is in the aperture and no other point is
  more than 2 px nearer. Tab at a point prompt (Shift+Tab back) cycles through the points in
  the aperture in priority order (bands of points within 2 px, by mode), wrapping around;
  the tooltip then reads e.g. "Schnittpunkt (Tab 2/3)". A move of more than `apertureSize`
  px (half the box side) from where Tab was pressed, or the chosen point leaving the
  aperture, resets to the best point; a click takes the chosen point. No further modes yet.
- Polar tracking (POLAR, F10, on by default; `cad/editor/tracking/PolarTracking.ts`): at the
  second point of `SCHIEBEN` only, where no snap point is found (a snap point always wins;
  works with F3 off), the point goes onto the nearest ray from the base point at a polar
  angle (`PolarSettings`: `incrementAngle`, default 90, and `additionalAngles`, in App state
  like the snap settings), when the cursor is at most `polarTolerance` px from it and at
  least as far from the base point; 2 px hysteresis like the snap. Click, move preview and
  direct distance entry use that point (`previewPoint`), the snapshot carries `polar`
  (angle, point, distance). Shown by `SnapMarker.showPolar`: dashed path from the base
  point to the canvas edge, an x and the tooltip "Polar: 1000.00 < 90°" (token
  `--polar-track`); the crosshair magnet (`snapMagnet`) also holds the polar point. Status
  bar "POLAR" switch with a menu of the increments (`POLAR_INCREMENTS`, radio: one increment,
  all its multiples apply) and a "Zusatzwinkel" text field (`parseAngleList`, e.g. "30, 60",
  at most `MAX_ADDITIONAL_ANGLES`; every valid edit applies at once, invalid text is marked
  and keeps the last valid angles). Relative-to-last-segment angles are not built yet.
- Ortho (ORTHO, F8, off by default; `cad/editor/tracking/ortho.ts` `orthoPoint`): at the
  second point only, where no snap point is found, the point goes onto the horizontal or
  vertical through the base point, whichever is nearer, without any tolerance; click,
  preview, rubber band and direct distance entry follow it (`SelectionEditor.pointAt`),
  with no path, tooltip or crosshair magnet (like AutoCAD). Typed coordinates win. Ortho
  and POLAR exclude each other: App keeps both as `TrackingModes` and switches through
  `withOrtho`/`withPolar` (editorSettings); the editor gets `setOrtho()` and leaves polar
  tracking out while Ortho is on.
- Grid (RASTER, F7, on by default; display only, like AutoCAD GRIDMODE): lines parallel to X
  and Y through the model origin, every `majorEvery`-th a major line, on its own canvas under
  the drawing (`ui/GridLayer.ts`, so it is never in the document, the content bounds,
  picking or snapping). Adaptive like AutoCAD: the shown step is `spacing × majorEvery^k`
  (factor 2 at `majorEvery` 1) with the smallest k ≥ 0 that keeps the lines at least
  `gridMinSpacing` px apart, never finer than `spacing` (`cad/renderer/grid.ts`: `gridStep`,
  `gridLines`, only the visible lines, by index). `GridSettings` (`enabled`, `spacing` mm,
  `majorEvery`; default 10 mm / 10) live in App state; the status bar "RASTER" switch has a
  menu with both values (`parseGridSpacing`, `parseMajorEvery`; valid edits apply at once and
  switch the grid on). Colours per theme in `EditorSettings.gridColor`. No grid snap (F9),
  separate X/Y spacing, dot style, isometric grid or limits yet.
- Only outlines are hit, never fills: an element is hit when its outline passes through
  the square pick box around the cursor. Elements on hidden or locked layers are not
  selectable. Picking a grouped element picks its whole group. While a rectangle or lasso
  is open, what it would pick is previewed in the hover style.

Structure (all pure TS and unit-tested unless noted):

- `cad/editor/SelectionEditor.ts`: the selection and `SCHIEBEN` state machine, independent
  of Paper.js and React. It gets `EditorPointerEvent`s and key events and publishes an
  immutable `SelectionSnapshot` (prompt, typed input, message, hovered, highlighted, grips, area,
  cursor mode, snap, Tab cycle position, snap preview, polar track, base point, preview point, can undo/redo) via
  `subscribe()`. It holds the Tab cycle state; the engine stays stateless. It runs
  on a `DocumentHistory`. Before further commands (KOPIEREN, DREHEN …) it should be split
  into an editor core and per-command state machines. Typed text is parsed by the pure
  `cad/editor/commandInput.ts` (`parsePointInput`, `resolvePointInput`, `matchesKeyword`).
- `cad/editor/commands/`: `DocumentCommand` (`execute`/`undo` on immutable documents,
  returning the new document and the changed element ids), `DocumentHistory` (current
  document, undo/redo stacks, listeners), `MoveCommand`. `CadCanvas` keeps the history of
  the loaded document; the editor and the renderer follow it (`PaperRenderer.updateElements`
  replaces only the changed items, subscribed before the editor so its overlay sees the new
  paths). The editor's derived structures are rebuilt as a whole on every change for now.
- `cad/editor/tracking/PolarTracking.ts`: `polarAngles`, `findPolarTrack` (pure, stateless;
  the editor keeps the previous track for the hysteresis), `parseAngleList`/`formatAngleList`
  for the additional angles field.
- `cad/editor/snapping/`: `SnapMode` (modes, German labels, precedence), `SnapGeometry`
  (exact snap primitives per element with sampled polylines and fixed snap points; snap
  points of a whole element, so far only GCE, as `ElementSnapPoint`), `intersections`, `SnapEngine` (`candidates(query, SnapMemory, previous)`: all points in
  the aperture best first, `previous` for the hysteresis; `find` takes the first). Uses the
  generic `ShapeIndex`.
  Built on load like the selection structures. Geometry helpers in `cad/geometry/`
  (`bezier`, `intersect`, `arc.angleOnArc`, `polygon.polygonCentroid`); `cad/model/drawOrder.ts` gives the renderer's
  element order for selection and snapping.
- `cad/editor/selection/`: `ElementShapes` (flattened outlines), `ShapeIndex` (`rbush`
  R-tree over their bounds), `picking` (point/window/crossing/lasso), `grips`, `grouping`.
  All derived from the document; rebuilt by the editor after every document change.
- `cad/editor/overlays/SelectionOverlay.ts` (Paper.js): hover/selection highlights as
  restyled copies of the rendered paths, grips (beziers also get a dashed control frame
  from each end to its control point, as their control grips lie off the curve),
  rectangle/lasso, the move preview (offset copies), one palette per theme.
- `ui/canvasInput.ts`: the single owner of canvas input (zoom, pan, forwarding to the
  editor, pointer capture, lost-release and `pointercancel` handling) and of the cursor.
  `ui/CommandLine.tsx` is display only (prompt, typed input, caret); the editor gets the keys.
- `ui/SnapMarker.ts`: snap marker, tooltip (flips at the canvas edge), polar path, the move's
  rubber band (above the polar path), the snap point preview (one path, `previewPath`) and
  base point cross as an SVG/DOM layer over the canvas, positioned by `CadCanvas` in view px.
  Tokens `--snap-marker`, `--polar-track`, `--snap-tooltip-bg|fg|border`; rubber band and
  preview use `--preview-color`, which `SnapMarker` sets from `EditorSettings.previewColor`
  for the theme (`setTheme`). `ui/StatusBar.tsx` holds
  the RASTER, ORTHO, POLAR and OFANG switches on the left, position and zoom on the right (so the switches
  never move).
- Cursor: over the canvas the system pointer is hidden and `ui/CrosshairCursor.ts` draws an
  AutoCAD-like crosshair as a DOM layer (moved by CSS transform, so the drawing is never
  redrawn for it), with the pick box as a square in its centre and a minus sign off its
  top right corner while Shift is held (picks then remove); while panning the grab hand
  shows instead. Colour token `--crosshair`.
- Central settings: `src/settings/editorSettings.ts` (`EditorSettings`,
  `DEFAULT_EDITOR_SETTINGS`): `crosshairSize` (% of the drawing area's larger side, like
  AutoCAD CURSORSIZE; 100 = across the whole area), `pickboxSize` (half side in px, like
  PICKBOX; also the hover/click tolerance), `showPickbox`, `apertureSize` (half side in
  px, like APERTURE), `showApertureBox` (APBOX), `snapMarkerSize` (AUTOSNAPSIZE) and
  `snapMarker`/`snapTooltip`/`snapMagnet` (AUTOSNAP), `polarTolerance` (px), `snapPreview`
  and `previewColor` (per theme: light `#ea580c`, dark `#facc15`), `gridMinSpacing` (px) and
  `gridColor` (minor/major per theme). Code receives the object
  (App → `CadCanvas` → editor and crosshair) rather than importing the defaults, so the
  user can change them later; for now they are read when a document is loaded. The running
  snaps (`SnapSettings`: `enabled` like F3, `modes` like OSMODE), Ortho and polar tracking
  (`TrackingModes`: `ortho` like F8, `polar: PolarSettings` with `enabled` like F10 and the
  angles) and the grid (`GridSettings`, F7) live in App state and may
  change at any time.
- Translations (German and English): i18next in `src/i18n/i18n.ts` (one instance, also
  used outside React: `t` for the editor core and the DOM layers, `I18nextProvider` in
  `main.tsx` and `useTranslation` in components). Texts in `src/i18n/locales/de.ts` (the
  reference; its type `Translations` types the keys) and `en.ts` (typed as `Translations`,
  so a missing key fails `tsc`); command line texts follow the German resp. English
  AutoCAD. Never hard-code visible text. Language: remembered in `localStorage`, else the
  browser language, toolbar "Sprache" DE/EN; `<html lang>` follows. `SelectionEditor` keeps
  messages as thunks and translates prompt and message when it builds a snapshot;
  `CadCanvas` calls `refreshTexts()` on `languageChanged`. The keyword is translated too
  (`Verschiebung`/`Displacement`). Command names are not in the translation files:
  `cad/editor/commandAliases.json` maps each English AutoCAD name (the command id,
  `EditorCommand`, e.g. `MOVE`) to its aliases (`{"MOVE": ["SCHIEBEN"]}`); the first alias is
  the name shown in German (`commandNames.ts`: `commandName`, `findCommand`; a name wins over
  an alias). Prompts take the name as `{{command}}`. Tests run in German (`src/i18n/testSetup.ts`, Vitest `setupFiles`).
- Light/dark mode: `ui/theme.ts` (`system` / `light` / `dark`, remembered in
  `localStorage`, sets `data-theme` on `<html>` for the CSS tokens in `index.css`).
  Drawing colours are adapted for display only in `cad/renderer/displayColor.ts`
  (strokes: mirrored lightness, at least 0.6; fills: same distance from the background
  and same chroma as on white); the stored document is never changed.
  `DARK_CANVAS_BG` there must match `--canvas-bg` in `index.css`.

## git
For now, we can just work in the main-branch directly and commits to git will happen manually.

## Workflow
One developer works on this project alone, one chat at a time: no parallel chats or
sessions, no worktrees. Work sequentially in this folder on main; there is no need to
guard against concurrent edits or to split work across parallel sessions.
