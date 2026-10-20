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
  middle/Space+drag pan, status line, light/dark mode) and has AutoCAD-like object
  selection (see "Editor: current state" below). There is no snapping, moving or editing
  yet; grips are drawn but have no function.

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
- **`docs/`**: `docs/todo/setup.md` (architecture concept, German),
  `docs/editor-bedienung.md` (controls of the old editor), `docs/architecture/cqrs.md`.
  The editor docs describe the old editor and are background only.

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

Object selection follows AutoCAD, with one deliberate deviation: **press + drag in empty
space spans a rectangle** (like AutoCAD with `PICKDRAG=2` and the lasso turned off); the
**lasso needs Alt (⌥) held on the press**. Otherwise:

- No command active (noun-verb): click adds to the pickfirst selection (highlight +
  grips), Shift removes, Esc clears. Clicking empty space without dragging also opens a
  rectangle that the next click ends. Rectangle to the right = window (completely
  inside), to the left = crossing (touches); lasso direction picks the mode, Space toggles.
- Toolbar tool "Auswahl" starts the `AUSWAHL` command (verb-noun): takes over the
  pickfirst selection, grips disappear, the command line shows AutoCAD-style prompts and
  counts ("1 gefunden, 2 gesamt"). Enter or right click ends it (result kept as
  `previous`, nothing stays highlighted), Esc cancels.
- Only outlines are hit, never fills. Elements on hidden or locked layers are not
  selectable. Picking a grouped element picks its whole group. While a rectangle or lasso
  is open, what it would pick is previewed in the hover style.

Structure (all pure TS and unit-tested unless noted):

- `cad/editor/SelectionEditor.ts`: the selection state machine, independent of Paper.js
  and React. It gets `EditorPointerEvent`s and key events and publishes an immutable
  `SelectionSnapshot` (prompt, message, hovered, highlighted, grips, area) via `subscribe()`.
- `cad/editor/selection/`: `ElementShapes` (flattened outlines), `ShapeIndex` (`rbush`
  R-tree over their bounds), `picking` (point/window/crossing/lasso), `grips`, `grouping`.
  All derived from the document and **only built on load**; once commands change the
  document, these must be updated too.
- `cad/editor/overlays/SelectionOverlay.ts` (Paper.js): hover/selection highlights as
  restyled copies of the rendered paths, grips, rectangle/lasso, one palette per theme.
- `ui/canvasInput.ts`: the single owner of canvas input (zoom, pan, forwarding to the
  editor, pointer capture, lost-release and `pointercancel` handling). `ui/CommandLine.tsx`
  is display only.
- Light/dark mode: `ui/theme.ts` (`system` / `light` / `dark`, remembered in
  `localStorage`, sets `data-theme` on `<html>` for the CSS tokens in `index.css`).
  Drawing colours are adapted for display only in `cad/renderer/displayColor.ts`
  (strokes: mirrored lightness, at least 0.6; fills: same distance from the background
  and same chroma as on white); the stored document is never changed.
  `DARK_CANVAS_BG` there must match `--canvas-bg` in `index.css`.

## git
For now, we can just work in the main-branch directly and commits to git will happen manually.
