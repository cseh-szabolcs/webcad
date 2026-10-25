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
  selection, a grid, a UCS icon, object snap, polar tracking, object snap tracking, Dynamic Input, the LINE command (`LINIE`), the PLINE command (`PLINIE`, straight segments only), the CIRCLE command (`KREIS`), the ELLIPSE command, the RECTANG command (`RECHTECK`) and the MOVE command (`SCHIEBEN`) with preview,
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
  every mouse and keyboard action. Keep it in sync when the controls change. It never
  states values from `src/settings/editorSettings.ts` (defaults, start states, colours,
  px sizes): it names the setting instead (e.g. "Einstellung `apertureSize`"), so they are
  kept in one place. New settings get a row (name, meaning, AutoCAD) in its "Einstellungen"
  table, without a value. The same goes for fixed constants in the code (thresholds,
  tolerances, limits): name the constant and its file (e.g. "`TIE_TOLERANCE_PX` in
  `src/cad/editor/snapping/SnapEngine.ts`") instead of its value; renaming or moving such a
  constant means updating the guide.

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
- Commands start from the vertical tool panel on the left (`ui/ToolPanel.tsx`, icon buttons
  from `ui/ToolIcon.tsx` with the name in the tooltip, groups "Zeichnen": Linie, Polylinie, Kreis, Ellipse, Rechteck and
  "Ändern": Verschieben; a click on another tool cancels the running command, on the same one does
  nothing) or by typing a name or alias at "Befehl:" (`SelectionEditor.startCommand`). Enter
  with nothing typed at "Befehl:" repeats the last command started (Space keeps panning).
- Tool "Verschieben" starts `SCHIEBEN` (AutoCAD MOVE, id `MOVE`); so does typing
  `SCHIEBEN` or `MOVE` (any case, either language) at "Befehl:" with Enter or Space (Esc and
  Backspace edit the text; Space/Esc keep their meaning while nothing is typed;
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
  Ctrl/⌘+Z, Ctrl+Y or ⌘+⇧+Z (command line "Rückgängig: SCHIEBEN"). Esc cancels at every prompt. The selection stays
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
- Tool "Linie" starts `LINIE` (AutoCAD LINE, id `LINE`, aliases `LINIE`, `L`;
  `cad/editor/tools/LineTool.ts`); the pickfirst selection is dropped. "Ersten Punkt angeben:"
  (`point` prompt; Enter alone continues from the end vertex of the line or polyline LINIE or
  PLINIE drew last, kept in the core's `DrawingMemory` (`tools/DrawingMemory.ts`,
  `continuePoint`: an open polyline's last vertex, a closed one's first), else "Keine Linie
  oder kein Bogen zum Fortsetzen."), then
  "Nächsten Punkt angeben oder [Zurück]:" / "[Schließen/Zurück]:" from two segments on (`next`
  prompt from the last point, so polar, Ortho, OTRACK, `@`, direct distance and the DYN
  dimension work from it). Every point executes an `AddLineCommand` at once (own two vertices,
  no layer/group/style), so it is drawn and snappable; a point on the last one adds nothing.
  "Zurück"/`Undo` takes the last one back (`DocumentHistory.revertLast`, no redo; with none
  left "Alle Segmente bereits zurückgenommen."), "Schließen"/`Close` adds one to the series
  start and ends. Enter (or right click) and Esc (`*Abbruch*`) end, keeping the lines; the run's
  segments become one undo step (`DocumentHistory.combineLast` → `CompositeCommand`,
  "Rückgängig: LINIE"). Preview: a solid line `from` → preview point in the default style
  (`SelectionOverlay`, `OverlayHost.applyStyleById`). Not yet: tangent continue from arcs,
  current layer/style, shared vertices.
- Tool "Polylinie" starts `PLINIE` (AutoCAD PLINE, id `PLINE`, aliases `PLINIE`, `PL`;
  `cad/editor/tools/PolylineTool.ts`), straight segments only so far (spec
  `depts/editor/docs/specs/PLINE_Werkzeug_Spezifikation.md`; what is left, with the proposed
  `bulges` schema for arcs, in `depts/editor/docs/todo/Polyline_Draw_NotImplemented.md`).
  "Startpunkt angeben:" like LINIE's first point (Enter continues via `DrawingMemory`), then
  "Nächsten Punkt angeben oder [Zurück]:" / "[Schließen/sehnenLänge/Zurück]:" from one segment
  on (`next` prompt from the last point). The points stay in the tool until the command ends: the
  preview `{ kind: 'polyline', points }` draws them plus the segment to the preview point
  (`SelectionOverlay`), the document is unchanged and the segments are not snappable (like
  AutoCAD). A point on the last one adds nothing; "Zurück" drops the last point (with only
  the start point "Alle Segmente bereits zurückgenommen."); "Schließen" ends with `closed`
  (a last point on the start point is dropped). Enter, right click, Esc (`*Abbruch*`), and
  another tool started, end it: the tool itself executes one `AddPolylineCommand` (own
  vertices, no layer/group/style; nothing with only the start point), so Esc keeps it too;
  one undo step "Rückgängig: PLINIE". "sehnenLänge"/`Length` (`L`; keyword shortcut from its
  capital, see `matchesKeyword`) asks "Länge der Linie angeben:", a `distance` prompt from the
  last point: the tool's `distance()` gets a typed number, or the distance from the last point
  to a point given (snap, polar, Ortho, OTRACK apply), and adds a segment that long in the
  direction of the last segment; only a positive one ("Wert muss positiv und ungleich Null
  sein.", the prompt stays), no options ("Erfordert numerischen Abstand oder zweiten Punkt.").
  Its preview carries `direction`: the segment along it as long as the preview point is from
  the last point, plus the dashed rubber band to the preview point (`CadCanvas`, SnapMarker).
  Not yet: arcs, width, snapping to its own segments.
- Tool "Kreis" starts `KREIS` (AutoCAD CIRCLE, id `CIRCLE`, aliases `KREIS`, `K`, `C`;
  `cad/editor/tools/CircleTool.ts`, spec `depts/editor/docs/specs/CIRCLE_ELLIPSE_Werkzeug_Spezifikation.md`,
  what is left in `depts/editor/docs/todo/Circle_Ellipse_Draw_NotImplemented.md`). "Zentrum für
  Kreis angeben oder [3P/2P]:" (`point`), then "Radius für Kreis angeben oder [Durchmesser]:", a
  `distance` prompt from the centre (typed number, or distance to a point given); "Durchmesser"
  (`D`) asks "Durchmesser für Kreis angeben:" the same way. `3P`/`2P` are compared whole (not via
  `matchesKeyword`, where "P" would match both): 2P asks two diameter ends (`point`, then `next`
  from the first), 3P three points (`next` from the previous one; `geometry/circle.ts`
  `circleThrough`, `circleOnDiameter`). Points that give no circle are ignored; radius ≤ 0 →
  "Wert muss positiv und ungleich Null sein."; no default radius yet. The circle ends the command as
  the step's `AddCircleCommand` (own centre vertex, no layer/group/style; "Rückgängig: KREIS");
  Esc ends without one. Preview `{ kind: 'curve', curveAt, rubberBand }` (`ToolPreview`): the tool
  computes the `PreviewCurve` for the preview point, `SelectionOverlay` draws it, `CadCanvas` the
  dashed rubber band from `from` with `rubberBand`. Not yet: Ttr, TTT, CIRCLERAD default, dropdown.
- Tool "Ellipse" starts `ELLIPSE` (AutoCAD ELLIPSE, id `ELLIPSE`, aliases `ELLIPSE`, `EL`, the
  German name being the English one; `cad/editor/tools/EllipseTool.ts`). "Achsenendpunkt der
  Ellipse angeben oder [Mittelpunkt]:", "Anderen Endpunkt der Achse angeben:" (`next` from the first
  end, rubber band only), or with "Mittelpunkt" (`M`) "Mittelpunkt der Ellipse angeben:" and
  "Endpunkt der Achse angeben:"; then "Abstand zur anderen Achse angeben:", a `distance` prompt
  from the centre (half the other axis, like AutoCAD getdist). The first axis stays `radiusX` at its
  angle, even when it is the minor one. `EllipseElement.rotation` (optional, radians,
  counter-clockwise from +X, missing = 0, so older documents stay valid) is drawn, picked, snapped
  and gripped (`geometry/ellipse.ts`). `AddEllipseCommand` ("Rückgängig: ELLIPSE").
  Not yet: Drehung (needs an angle prompt), Bogen (needs an elliptical arc model).
- Tool "Rechteck" starts `RECHTECK` (AutoCAD RECTANG, id `RECTANG`, aliases `RECHTECK`, `REC`;
  `cad/editor/tools/RectangleTool.ts`, spec `depts/editor/docs/specs/RECTANG_Werkzeug_Spezifikation.md`,
  what is left in `depts/editor/docs/todo/Rectangle_Draw_NotImplemented.md`). "Ersten Eckpunkt
  angeben:" (`point`, no options yet), then "Anderen Eckpunkt angeben oder [Abmessungen]:" (`next`
  from the first corner); the click gives the rectangle with sides along X and Y
  (`rectangleCorners`: first corner, along X, other corner, along Y; a corner without area is
  ignored). "Abmessungen"/`Dimensions` (`A`/`D`) asks "Länge der Rechtecke angeben:" and "Breite
  der Rechtecke angeben:" (`distance` prompts from the first corner, positive only, no default
  yet), then the same corner prompt, where a point only chooses the quadrant (on an axis the
  positive side). Preview `{ kind: 'curve' }` with the `PreviewCurve` `{ kind: 'polygon', points }`
  (closed). The step's command is an `AddPolylineCommand` (closed, label `RECTANG`, "Rückgängig:
  RECHTECK"). Not yet: Fasen, Abrunden, Breite, Erhebung, Objekthöhe, Fläche, Drehung, defaults.
- Right click acts like Enter (AutoCAD right-click customization "Repeat Last Command" /
  "ENTER"; no context menus yet): at a point prompt it calls the same `submitInput` as Enter
  (typed text, else the tool's default); at "Objekte wählen:" it ends the selection; with no
  command it runs a typed name or repeats the last command (also with a pickfirst selection).
  Ignored while a rectangle or lasso is open or being dragged (`area`/`press`). Tools have no
  right-click hook of their own.
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
  (angle, point, distance). Shown by `SnapMarker.showTracking`: dashed path from the base
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
  tracking out while Ortho is on. Holding Shift switches Ortho over for the moment (AutoCAD's
  temporary override): `canvasInput` reports it via `InputTarget.setShiftHeld` on every cursor
  update, pointer events carry it too, and `SelectionEditor.orthoActive()` is
  `ortho !== shiftHeld`; settings and status bar stay unchanged. Further AutoCAD shortcuts to
  build later are listed in `depts/editor/docs/todo/Zeichnen_Tastenkuerzel.md`.
- Object snap tracking (OTRACK, F11, off by default; `cad/editor/tracking/ObjectSnapTracking.ts`):
  at every point prompt, a snap point that stays the editor's snap point for
  `trackingAcquireDelay` ms is acquired (a timer in `SelectionEditor`, `toggleAcquired`;
  dwelling again drops it, at most `MAX_ACQUIRED_POINTS`, FIFO); the point a prompt starts on
  is only acquired after the snap changed. Needs F3 on. Where no snap point is found, the
  point goes onto the nearest ray from an acquired point (0/90/180/270°, or all polar angles
  with `ObjectTrackingSettings.allPolarAngles`; `nearestRay` shared with polar tracking,
  `polarTolerance`, 2 px hysteresis), or onto where two rays of different origins cross in
  the aperture box, at the second point also with the polar rays from the base point or the
  Ortho axis (with Ortho only crossings, so the point stays on the axis). Precedence: snap >
  crossing > nearer of single tracking path and polar path (`polarWins`) > Ortho. The
  snapshot carries `acquired` and `objectTrack` (point, paths with origin, angle, distance,
  source); direct distance entry on a single path goes from the acquired point. Acquired
  points hold for one point prompt (cleared by the next point, Esc, end of command, OTRACK
  off). Shown by `SnapMarker.showTracking` (paths from the origins, the Ortho axis left out,
  tooltip `trackingTooltipText`, e.g. "Endpunkt: < 270°, Polar: < 180°") and `showAcquired`
  (small + per point); the magnet holds the point. Status bar "OTRACK" switch with a radio
  menu (orthogonal / all polar angles); `ObjectTrackingSettings` live in App state. Not yet:
  Shift to acquire, tracking × object intersections, EXT/PAR/TT/FROM, aligning the moved
  object's edges.
- Dynamic Input (DYN, F12, on by default; pure logic in `cad/editor/dynamicInput.ts`,
  display in `ui/DynamicInputLayer.ts`): `DynamicInputSettings` (`enabled`, `pointerInput`,
  `dimensionInput`, `prompts`) in App state, status bar "DYN" switch with a checkbox menu. At a
  point prompt that shows fields (`dynamicLayout`: base point/displacement with pointer input;
  second point or a distance on a dimension with dimension input, else at the crosshair) the
  keys go into two fields (`DynamicInputState`) instead of `input`: X/Y absolute at the first point (`@` relative
  to LASTPOINT), distance/angle relative to the base point at the second (`,` switches to X/Y,
  `<` to polar, `#` absolute); at a `distance` prompt only the distance field (format
  `distance`, `fields` has one entry, no angle arc, `,`/`<` stay in it so the text is a point,
  Tab still cycles snaps, a typed number goes to the tool as is). Empty fields show live values of the tracked point
  (`trackedPointAt`); typed numbers bind it at once (`dynamicPoint`, applied in `pointAt`, so
  preview, rubber band, click and Enter agree): a lone distance is direct distance entry (from
  the OTRACK origin on a single path), a lone angle goes along its ray as far as the tracked point is from the reference (never backwards). Tab switches fields
  once something is typed, else it still cycles snaps; non-numeric text goes to `submitText`
  as if typed on the command line (keyword `V`). The snapshot carries `dynamicInput`
  (`DynamicInputView`) and `input` echoes the fields (`dynamicText`). `CadCanvas` draws the
  panel above right of the crosshair (prompt, fields, lock on typed fields) or the dimension
  (aligned dimension with ticks, angle arc), and an x at a bound point; tokens `--dyn-*`. Not
  yet: ↓ options menu, DYNPIFORMAT/DYNPICOORDS settings, several dimensions, invalid-field
  marking, units/precision, command autocomplete.
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
- UCS icon (2D style, like AutoCAD UCSICON; display only): X axis right, Y axis up, labels
  "X"/"Y", the WCS square at the origin (always, there is only the WCS). It sits on the model
  origin while the whole icon fits there with `UCS_ICON_MARGIN_PX` to spare, else in the
  lower left corner (`cad/renderer/ucsIcon.ts`: `ucsIconExtent`, `ucsIconPosition`).
  `ui/UcsIcon.ts` draws it as an SVG layer over the drawing and under crosshair and snap
  marker (`pointer-events: none`), token `--ucs-icon`. Settings `ucsIcon` (ON/OFF),
  `ucsIconAtOrigin` (ORigin/Noorigin), `ucsIconSize` (axis px), `ucsIconLabelSize` (label font
  px; the label room in the fit check is gap + font size), `ucsIconOpacity` (on the group). No custom UCS (and so no
  effect on input, Ortho, polar or grid), no selection/grips, no UCSICON command yet.
- Only outlines are hit, never fills: an element is hit when its outline passes through
  the square pick box around the cursor. Elements on hidden or locked layers are not
  selectable. Picking a grouped element picks its whole group. While a rectangle or lasso
  is open, what it would pick is previewed in the hover style.

Structure (all pure TS and unit-tested unless noted):

- `cad/editor/SelectionEditor.ts`: the editor core, independent of Paper.js and React: the
  selection, a command's object selection and all point prompt machinery (snap, Tab, polar,
  Ortho, OTRACK, Dynamic Input, typed input, LASTPOINT). It gets `EditorPointerEvent`s and key
  events and publishes an immutable `SelectionSnapshot` (prompt, typed input, message, hovered,
  highlighted, grips, area, cursor mode, snap, Tab cycle position, snap preview, polar track,
  acquired points, object snap track, `from`, `preview`, preview point, Dynamic Input fields,
  can undo/redo) via `subscribe()`. It holds the Tab cycle state and the acquire timer; the
  engine stays stateless. It runs on a `DocumentHistory`. Typed text is parsed by the pure
  `cad/editor/commandInput.ts` (`parsePointInput`, `resolvePointInput`, `matchesKeyword`: a
  start of the keyword from its first capital on, or the whole keyword, like AutoCAD's
  `sehnenLänge` → `L`).
- `cad/editor/tools/`: one state machine per command behind `EditorTool` (`EditorTool.ts`):
  the tool sets its `prompt` (`select`, or `point` with `input` `point` | `next` (measured
  from `from`: polar, Ortho, direct distance, `@`, DYN dimension) | `vector` | `distance`
  (from `from` like `next`, but the tool gets `distance()`: a typed number as is, or the
  distance to a point given; invalid text "Erfordert numerischen Abstand oder zweiten
  Punkt.")), gets the selected objects, given points, distances and option text (`''` = Enter
  or right click), and returns a
  `ToolStep` (`done`, `message`, a `DocumentCommand` to run after the end). A new prompt
  object starts a new point prompt. `MoveTool` is SCHIEBEN, `LineTool` LINIE (it runs its
  segments on the history itself), `PolylineTool` PLINIE (it runs its polyline on the history
  when it ends), `CircleTool` KREIS, `EllipseTool` ELLIPSE and `RectangleTool` RECHTECK (their
  element is the step's command); `SelectionEditor.newTool` creates them.
- `cad/editor/commands/`: `DocumentCommand` (`execute`/`undo` on immutable documents,
  returning the new document and the changed element ids), `DocumentHistory` (current
  document, undo/redo stacks, listeners, `revertLast`, `combineLast`), `MoveCommand`,
  `AddLineCommand`, `AddPolylineCommand` (its `label` names the command, PLINE or RECTANG), `AddCircleCommand`, `AddEllipseCommand`, `CompositeCommand`. `CadCanvas` keeps the history of
  the loaded document; the editor and the renderer follow it (`PaperRenderer.updateElements`
  replaces only the changed items, subscribed before the editor so its overlay sees the new
  paths). The editor's derived structures are rebuilt as a whole on every change for now.
- `cad/editor/tracking/PolarTracking.ts`: `polarAngles`, `nearestRay`, `findPolarTrack` (pure, stateless;
  the editor keeps the previous track for the hysteresis), `parseAngleList`/`formatAngleList`
  for the additional angles field. `ObjectSnapTracking.ts`: `toggleAcquired`,
  `trackingAngles`, `findObjectTrack`, `polarWins` (pure).
- `cad/editor/snapping/`: `SnapMode` (modes, German labels, precedence), `SnapGeometry`
  (exact snap primitives per element with sampled polylines and fixed snap points; snap
  points of a whole element, so far only GCE, as `ElementSnapPoint`), `intersections`, `SnapEngine` (`candidates(query, SnapMemory, previous)`: all points in
  the aperture best first, `previous` for the hysteresis; `find` takes the first). Uses the
  generic `ShapeIndex`.
  Built on load like the selection structures. Geometry helpers in `cad/geometry/`
  (`bezier`, `intersect`, `arc.angleOnArc`, `polygon.polygonCentroid`, `ellipse` for rotated
  ellipses, `circle`); `cad/model/drawOrder.ts` gives the renderer's
  element order for selection and snapping.
- `cad/editor/selection/`: `ElementShapes` (flattened outlines), `ShapeIndex` (`rbush`
  R-tree over their bounds), `picking` (point/window/crossing/lasso), `grips`, `grouping`.
  All derived from the document; rebuilt by the editor after every document change.
- `cad/editor/overlays/SelectionOverlay.ts` (Paper.js): hover/selection highlights as
  restyled copies of the rendered paths, grips (beziers also get a dashed control frame
  from each end to its control point, as their control grips lie off the curve),
  rectangle/lasso, the move preview (offset copies), the LINIE/PLINIE previews, the KREIS/ELLIPSE/RECHTECK
  curve preview (`PathSpec.ellipsePathSpec`, a closed path for a polygon), one palette per theme.
- `ui/canvasInput.ts`: the single owner of canvas input (zoom, pan, forwarding to the
  editor, pointer capture, lost-release and `pointercancel` handling) and of the cursor.
  `ui/CommandLine.tsx` is display only (prompt, typed input, caret); the editor gets the keys.
- `ui/SnapMarker.ts`: snap marker, tooltip (flips at the canvas edge), tracking paths (polar
  and object snap tracking, `showTracking`), acquired points (`acquiredPath`), the move's
  rubber band (above the tracking paths), the snap point preview (one path, `previewPath`) and
  base point cross as an SVG/DOM layer over the canvas, positioned by `CadCanvas` in view px.
  Tokens `--snap-marker`, `--polar-track`, `--snap-tooltip-bg|fg|border`; rubber band and
  preview use `--preview-color`, which `SnapMarker` sets from `EditorSettings.previewColor`
  for the theme (`setTheme`). `ui/StatusBar.tsx` holds
  the RASTER, ORTHO, POLAR, OFANG, OTRACK and DYN switches on the left, position and zoom on the right (so the switches
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
  `snapMarker`/`snapTooltip`/`snapMagnet` (AUTOSNAP), `polarTolerance` (px, also for object snap tracking), `trackingAcquireDelay` (ms), `snapPreview`
  and `previewColor` (per theme: light `#ea580c`, dark `#facc15`), `gridMinSpacing` (px) and
  `gridColor` (minor/major per theme), `ucsIcon`/`ucsIconAtOrigin`/`ucsIconSize`/`ucsIconLabelSize`/`ucsIconOpacity` (UCSICON).
  Code receives the object
  (App → `CadCanvas` → editor and crosshair) rather than importing the defaults, so the
  user can change them later; for now they are read when a document is loaded. The running
  snaps (`SnapSettings`: `enabled` like F3, `modes` like OSMODE), Ortho and polar tracking
  (`TrackingModes`: `ortho` like F8, `polar: PolarSettings` with `enabled` like F10 and the
  angles), object snap tracking (`ObjectTrackingSettings`, F11), Dynamic Input (`DynamicInputSettings`, F12) and the grid (`GridSettings`, F7) live in App state and may
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
