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
  Paper.js for rendering and geometry and Redux Toolkit for state (Redux not used yet).
  Phase 1 viewer exists: document model, serializer, `PaperRenderer`, zoom/pan. It loads
  the plan via `CadApiClient` from `GET /api/plans/{id}/document` (`?plan=<uuid>`, dev
  default is the fixture plan).

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
| Mailpit    | http://localhost:8025 (SMTP on 1025)                                 |
| phpMyAdmin | http://localhost:8210                                               |

The DB container is **MySQL 8.0** (`app`/`app`, database `app`). `.env`'s
`DATABASE_URL` points at it via the compose host `db`, so it only resolves inside the
containers.

PHPUnit runs with `failOnDeprecation`, `failOnNotice` and `failOnWarning`, so a
deprecation fails the suite.

Editor commands (from `depts/editor/`): `npm run dev`, `npm run build` (`tsc -b && vite build`),
`npm run lint` (oxlint), `npm test` (Vitest; `*.test.ts` next to sources, pure code
only, no canvas). Model coordinates are **mm with Y up**; `Viewport` flips Y.

**Editor core** (`src/cad/editor/`):
- **`CadEditor`** owns the immutable `CadDocument`, the `CommandManager`, the
  `SelectionManager` and the active tool. It has no React or Paper dependencies and talks
  to rendering only through `EditorView` (`PaperEditorView` = `PaperRenderer` +
  `SelectionOverlay`).
- **Commands** are pure: `execute(doc)`/`undo(doc)` return a new document plus
  `changedElementIds`, which feed `PaperRenderer.updateElements`. They never mutate their
  input.
- **React** reads `CadEditor.getSnapshot()` via `useEditorSnapshot` (`useSyncExternalStore`).
  Redux is not used.
- **Input:** `CanvasInputController` owns canvas input. The wheel zooms. Middle drag or
  Space + left drag pans. Everything else goes to the editor/tool: left click selects,
  Shift toggles, Delete/Backspace deletes, Esc clears, Cmd/Ctrl+Z undoes, Cmd/Ctrl+Shift+Z
  or Ctrl+Y redoes. Dragging a selected element moves the selection, and dragging a vertex
  handle moves that vertex.
- **Drags** use `editor.preview(command)` on every pointer move. The command is applied to
  the committed document without touching history. On release, `commitPreview()` executes
  it as one undo step; `cancelPreview()` (Esc) discards it. Undo/redo/load/delete abort a
  drag in progress via `Tool.onCancel`. New handle types (Phase 3: circle radius, Bézier
  controls) should follow this pattern.
- **Handles** are the vertices of the selected elements (`selectionHandles`), 8 px squares
  drawn by `SelectionOverlay`. Hit-testing happens in the tool via
  `ToolPointerEvent.pixelSize` (6 px radius) and takes priority over elements.
- **Deleting** elements also removes vertices that no remaining element references. Shared
  vertices stay.
- **Moving** a vertex moves it for every element that references it, so shared vertices
  act as connections. Rules for detaching them are a Phase 3 decision.

Vite proxies `/api` to `http://nginx` (same origin, no CORS). When running `npm run dev`
on the host, set `API_PROXY_TARGET=http://localhost:8080`.

`GET /api/plans/{id}/document` returns the raw document JSON with the revision as `ETag`.
For now `GetPlanDocumentHandler` reads `fixtures/plans/{uuid}.json` instead of the DB, and
only that handler gets replaced once `PlanVersion` exists. The same sample plan exists
twice, as `fixtures/plans/01994f4e-….json` (backend) and
`depts/editor/src/cad/__fixtures__/sample-plan.json` (frontend unit tests), because the
`php` container cannot see `depts/`. Keep them identical.

The `php` container mounts a named volume over `/app/depts`, so the editor sources are not visible from inside `php`. Run Node tooling on the host
or in the `editor` container.

## Architecture

The design concept is in `todo/setup.md` (German, git-ignored, so it may be missing
from a fresh clone). Its main decisions:

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

## git
For now, we can just work in the main-branch directly and commits to git will happen manually.
