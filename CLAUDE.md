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
- **CAD editor frontend** in `depts/editor/`: Vite + React 19 + TypeScript + Paper.js,
  **being rebuilt from scratch, closer to AutoCAD behaviour**, in small steps. It loads a plan
  through the API and draws and edits it (selection, snapping, tracking, drawing commands,
  MOVE, undo/redo); changes are not saved to the backend yet. **Everything about the editor
  (state, structure, rules, reference material) is in `depts/editor/CLAUDE.md`**, its user
  guide in `depts/editor/docs/bedienung.md`.

### Reference material (read, don't copy)

- **`depts/editor-old/`** (previous editor) and **`depts/demo1/`** (OSNAP reference): see
  `depts/editor/CLAUDE.md`; for comparison only, never imported.
- **`docs/`**: `docs/todo/setup.md` (architecture concept, German) and
  `docs/architecture/cqrs.md`.
- **`depts/editor/docs/bedienung.md`**: user guide of the editor (German); keep it in sync
  when the controls change (rules in `depts/editor/CLAUDE.md`).

## Running it (Docker)

Everything runs through `compose.yml`. Run PHP tooling inside the `php` container, not
on the host. This overrides the `symfony serve -d` advice in AGENTS.md.

```sh
docker compose up -d
docker compose exec php bin/console <cmd>          # e.g. debug:router, make:*, doctrine:migrations:migrate
docker compose exec php bin/phpunit                # all tests
docker compose exec php bin/phpunit --filter testIndex tests/Core/Controller/IndexControllerTest.php
docker compose exec php vendor/bin/php-cs-fixer fix   # @Symfony ruleset (php-cs-fixer/shim)
docker compose exec -T php vendor/bin/mate tools:list # AI Mate diagnostics; always run Mate this way
```

| Service    | URL / port                                                          |
|------------|---------------------------------------------------------------------|
| App        | http://localhost:8080 (nginx → php-fpm, document root `public/`)     |
| Editor dev | http://localhost:8081 (Vite; the `editor` container runs `npm run dev:init`) |
| Old editor | http://localhost:8082 (`editor-old` container, reference only)         |
| API docs   | http://localhost:8080/_doc (Stoplight UI), `/_doc.json` (OpenAPI); dev and test only |
| Mailpit    | http://localhost:8025 (SMTP on 1025)                                 |
| phpMyAdmin | http://localhost:8210                                               |

The DB container is **MySQL 8.0** (`app`/`app`). The backend is **multi-tenant** (one
database per customer, see `docs/architecture/tenancy.md`): `app_main` holds the tenant
registry (later the users), each tenant has `app_<name>`; in test `app_main_test` and
`app_<name>_test`. `.env`'s `DATABASE_URL` names `app_main` via the compose host `db`, so it
only resolves inside the containers. The `app` user may use every `app_%` database
(`docker/map/mysql-init.sql`, run only when the `db-data` volume is created).

```sh
docker compose exec php composer db:migrate              # app_main, then every tenant
docker compose exec php bin/console app:tenant:create demo --display-name=Demo
docker compose exec php bin/console app:tenant:list
docker compose exec php bin/console app:tenant:delete <name>   # drops the database, asks first
docker compose exec php bin/console app:tenants:run "doctrine:migrations:status"
docker compose exec php bin/console <cmd> --tenant=<name>    # any command, on that tenant
docker compose exec php bin/console app:fixture:create      # dev only: reset the tenant database, then the sample plan in a new project (asks first; -f, --project-name=…, --plan-id=<uuid>)
```

Until users can log in, `DEFAULT_TENANT` (`.env.dev`, `.env.test`; `demo`) selects the tenant
for requests and for commands without `--tenant`. Fresh test setup:
`docker compose exec -e APP_ENV=test php composer db:migrate:main`, then
`docker compose exec php bin/console app:tenant:create demo --env=test`.

PHPUnit runs with `failOnDeprecation`, `failOnNotice` and `failOnWarning`, so a
deprecation fails the suite.

`GET /api/plans/{id}/document` returns the plan from the tenant database as a
`PlanDocument`: its draft (`GetPlanDocumentHandler` in `src/Plan/Query/`, returning a
`PlanDocumentResult` with the document and the revision; `PlanDocumentReader` in
`src/Plan/` maps one version's entities, read through the repositories in
`src/Plan/Repository/` (`findByPlanVersion`), to the DTOs; vertices,
groups and styles come in id order, i.e. creation order for UUIDv7; `ElementRepository`
fetch-joins the polyline vertices first, so a read needs one query per kind of content, guarded
by `PlanDocumentReaderTest`), with the draft's `revision` as `ETag`
(304 on a matching `If-None-Match`). An element without a name is sent with `name: null`,
which `CadSerializer` reads as no name. In dev the editor loads the plan
`01994f4e-6f3a-7c2d-9b1e-5a3c2d1e0f42` when the URL names none (`DEV_PLAN_ID` in `App.tsx`);
`app:fixture:create` creates it under that id (`FixtureCreateCommand::DEV_PLAN_ID`).
The same sample plan exists twice, as `fixtures/plans/sample-plan.json` (backend: the source
of `app:fixture:create` and the expected document in the API tests) and
`depts/editor/src/cad/__fixtures__/sample-plan.json` (frontend unit tests), because the
`php` container cannot see `depts/`. Keep them byte-identical. Ids are numbered fixture
UUIDs `00000000-0000-7000-8000-000000000NNN` (vertices 001+, elements 101+, layers 201+,
groups 301+, styles 401+); readable names live in `name` and in `sampleIds.ts`. The plan
contains every element type (line, polyline, arc, circle, ellipse, bezier).

The `php` container mounts a named volume over `/app/depts`, so the editor sources are not
visible from inside `php`.

**Node tooling runs on the host** (`npm install`, `npm test`, `npm run lint|build`, run
inside `depts/editor/` or `depts/editor-old/`); the `editor`/`editor-old` containers only serve
Vite. Details (native bindings, `.npmrc`, Vite proxy) in `depts/editor/CLAUDE.md`. Model
coordinates are **mm with Y up** in editor and backend alike.

## Architecture

The design concept is in `docs/todo/setup.md` (German). Its main
decisions (still valid for the rebuild):

- **The persisted CAD document is independent of Paper.js, React and the editor tools.**
  Store what the user defined (vertices, elements, layers, groups, styles); compute what can
  be derived (midpoints, intersections, bounding boxes, snap candidates, selection/hover state
  are never saved). The editor's own architecture (layering, commands with undo, React only
  around the canvas) is in `depts/editor/CLAUDE.md`.
- **Backend persistence:** a plan's drawing is stored **relationally**, one entity per
  object, mirroring the editor's document model (tenant EM, `src/Plan/Entity`), and
  **versioned**: `Plan` (belongs to a `Project`; `name`, `draft`, `head`, `version` = number of
  the last publish, 0 at first) and `PlanVersion` (`plan`, `unit`, `revision` (the ETag),
  `number`: null for a draft, else the publish number, `name`: optional, given on publishing to
  find the version again, `createdAt`). The contents belong to a
  version (`planVersion`, column `plan_version_id`). **Plan vs. plan document:** `Plan` is only
  the frame (project, name, draft/head, versions; later `PlanDto` for `GET /api/plans/{id}`),
  the *plan document* is the drawing of one version as a whole (vertices, elements, layers,
  groups, styles, unit, `schemaVersion`), the editor's `CadDocument`. It has no entity of its
  own, as it is stored spread over the content entities; it exists only as `PlanDocumentDto`,
  built by `PlanDocumentReader` and taken apart by `PlanFactory`, and is what
  `GET /api/plans/{id}/document` sends. A new `Plan` makes its own draft; the editor
  works on the draft. Publishing (the action itself comes later) is
  `$plan->publish($copier->copy($plan->getDraft()), $name)`: the copy becomes the head with the
  next number and the name, if given; earlier heads stay as history, the draft stays. `plan.draft_id`/`head_id` and
  `plan_version.plan_id` refer to each other, so draft/head are nullable and `SET NULL` on delete
  in the database (else deleting a plan is blocked by the versions it cascades to). `unit` is
  `App\Plan\Enum\PlanUnit`, kept outside the entity folder because `EntityMappingTest` treats
  every file there as an entity. Contents: `Layer` and `Element` with a `position` (drawing/document order), `Group` (table
  `element_group`), `ElementStyle`, `Vertex` (shared by elements), `Element` with single table
  inheritance on `type` (`LineElement`, `PolylineElement`, `ArcElement`, `CircleElement`,
  `EllipseElement`, `BezierElement`; subclass columns are nullable in the database, siblings
  share columns such as `start_vertex_id`), and `PolylineVertex` (PK polyline + position).
  Every FK to the version and to vertices is `ON DELETE CASCADE`, layer/group/style `SET NULL`.
  **Everything as columns:** the vertex references, `polyline_vertex`, layer/group/style and also
  the values only needed to draw an element are columns, the display values mapped by the
  element subclass they belong to (`PolylineElement::isClosed()`, `ArcElement::isClockwise()`,
  `CircleElement::getRadius()`, `EllipseElement` `radiusX`/`radiusY`/`rotation`,
  `BezierElement::getStartControl()`/`getEndControl()`; nullable in the database, as all types
  share the table, never in PHP). `Vector2` (`src/Plan/Entity/`) is an `#[ORM\Embeddable]`
  (`final readonly`), embedded with a `columnPrefix` (`start_control_x` …); `EntityMappingTest`
  checks embeddables as mapped by their folder's entity manager. A new display value is a field
  of the subclass, a migration and a field of its `…ElementDto`. `PlanDocumentReader` builds the `…Dto` of
  each element type from the getters (`match` over the entity class), `PlanFactory` passes the
  values of the `…Dto` to the entity constructors; neither uses the serializer. The generic Doctrine type
  **`json_document`** (`src/Core/Doctrine/JsonDocumentType`, usable for any object) is in place
  but unused for now, kept for values better stored as one document: it normalizes the object
  with the app's serializer and adds its class name under `"#type"`, then denormalizes into that
  class on read (a Doctrine type does not know the property it converts), so moving or renaming
  a class stored this way needs a data migration of `"#type"`. As the type needs the (private)
  serializer, the public `JsonDocumentTypeRegistrar` registers an instance of it, called from
  `Kernel::boot()`; `JsonDocumentTypeTest` uses test classes of its own
  (`tests/Core/Doctrine/Fixtures/`). Element props were stored this way until
  `migrations/Tenant/Version20261029231058.php` moved them back to columns.
  `schemaVersion` belongs to the wire format, not to the database. Still planned: `User`, `ProjectMember`, REST API under
  `/api/projects` and `/api/plans/{id}/document|versions`, with revision/ETag-based conflict
  detection. Real-time collaboration is out of scope for V1.
- **DTOs** (`src/Plan/Dto/`, suffix `Dto`, so they are never named like the entities;
  `SchemaNameProcessor` drops the suffix, so the OpenAPI schema names and `ApiSchema['…']` in the
  editor stay `PlanDocument`, `CircleElement` …): `final readonly` classes describing exactly
  the JSON `CadSerializer.parseDocument` reads (`PlanDocumentDto`, `VertexDto`, `LayerDto`,
  `GroupDto`, `ElementStyleDto`, `Vector2Dto`, the element union `ElementDtoInterface` with a
  serializer `#[DiscriminatorMap]` on `type`, shared properties in `AbstractElementDto`). DTOs
  hold only DTOs and scalar values, never entities. `EllipseElementDto.rotation` is always sent
  (0 = axis-aligned). `PlanDocumentDtoTest` round-trips the sample plan through them.
  `GetPlanDocumentController` sends them. PHP class names are case-insensitive, so the suffix
  in capitals and as `Dto` would clash: always write `Dto`.
- **API documentation** (NelmioApiDocBundle, `config/packages/nelmio_api_doc.yaml`): the models
  and controller attributes are the only source; the OpenAPI document and from it the editor's
  TypeScript types are generated. Rules:
  - A documented action carries `#[Areas(['default'])]`, `#[OA\Tag]` (described under
    `documentation.tags`) and `#[OA\Get|Post|…]` with only `summary` and `responses`; the
    success response names its model (`new OA\JsonContent(ref: new Model(type: …))`), as
    nothing else tells Nelmio the response schema. Only paths under `path_patterns` (`^/api/`)
    are documented.
  - Models: `final readonly`, constructor promotion, required parameters before optional ones;
    a parameter without default is required, **except a nullable one**: Nelmio leaves those out
    of `required`, so a nullable property the API always sends is named in the class's
    `#[OA\Schema(required: …)]` (`AbstractElementDto::ALWAYS_SENT`, `ElementStyleDto.fillColor`).
    Limits as `#[Assert\…]`, prose in `#[OA\Schema]`/`#[OA\Property]`, no prose on a property
    whose type is another model (a `$ref`), `@param list<…>` for lists, `#[Assert\Valid]` on
    lists of models.
  - A union is an interface with the serializer's `#[DiscriminatorMap]`, declaring the shared
    properties (`public ?string $layerId { get; }`, so code holding the interface can read them),
    implemented in an abstract base class. Processors in `src/Core/OpenApi/` (tagged in `config/services.yaml`):
    `SchemaNameProcessor` drops the `Dto` and `Interface` suffixes (`CircleElementDto` → `CircleElement`,
    `ElementDtoInterface` → `Element`),
    `DiscriminatorBranchProcessor` gives each branch a title and its `type` as a required
    one-value enum, `RefSiblingProcessor` keeps prose next to a `$ref` via `allOf`,
    `GeneratedDefaultProcessor` drops object defaults, `UnionPropertiesProcessor` drops the
    interface's properties from the union (each branch documents them). `ApiDocumentationTest` checks the
    endpoint, the names, every union branch and the always-sent properties.
  - Editor types: `npm run generate:api` (host, backend running; `scripts/generate-api-types.mjs`,
    openapi-typescript, `API_DOC_URL` overrides `http://localhost:8080/_doc.json`) writes
    `depts/editor/src/api/schema.d.ts`: checked in, never edited by hand, ignored by oxlint. A
    model change is done only once it ran and the diff of `schema.d.ts` is committed with it.
    Code uses `ApiSchema['…']` from `src/api/types.ts`, no alias per model. openapi-typescript
    7.13 declares a TypeScript 5 peer; `overrides` in `package.json` lets it use the editor's
    TypeScript 6 (drop it once a release supports 6).
  - The editor keeps its own document model (`cad/model`); the API types meet it at
    `CadApiClient`, which types the response as `ApiSchema['PlanDocument']` and still validates
    it with `parseDocument`. `ApiDocumentFitsModel` there fails `tsc` when the generated types no
    longer fit `CadDocument` (renamed, retyped or removed property, new enum value, changed
    `type`); the API's `name: null` counts as a missing name.
- **`PlanFactory`** (`src/Plan/`) builds from a `PlanDocument` a new `Plan` with
  its draft filled (`create`) or a further version of a plan (`createVersion`), with a fresh
  UUIDv7 for every entity and the references rewritten (shared vertices stay shared); it
  persists, the caller flushes. Unknown references or another `schemaVersion` throw.
  **`PlanVersionCopier`** copies a version through the document (reader, then
  `createVersion`) instead of `__clone`, which could not rewrite the references between the
  copies; it copies the stored state, so flush first. No service uses it before the publish
  action exists, so the container drops it and tests build it by hand. The console command `app:fixture:create`
  (`src/Fixtures/FixtureCreateCommand.php`, not a command bus message) is
  registered only in dev (and test, for its test: `#[When]`), never in prod. After a
  confirmation (`-f` skips it) it resets the selected tenant's database
  (`TenantProvisioner::reset`: every table dropped, schema rebuilt from the migrations, run in a
  kernel of its own like the migrations of a new tenant), reads the backend copy of the sample
  plan through the serializer, creates it in a new project under `DEV_PLAN_ID` (`--plan-id`
  names another id), and prints the editor link from `EDITOR_URL` (`.env.dev`), i.e.
  `?plan=<id>`, which `App.tsx` reads. Its test runs on a tenant of its own.
- **Backend layout by business area**, not by layer; namespaces follow the folders:
  `src/Core/` is technology only (`Tenancy/` with its `Entity/`, `Repository/` and `Console/`,
  `Doctrine/` for `json_document`, `OpenApi/` processors, `Controller/IndexController` as a
  placeholder page), `src/Project/` (`Entity/`, `Repository/`, `Command/` with
  `CreateProjectCommand` and its handler, `Query/` with `GetProjectQuery`, its handler and
  `ProjectDto`), `src/Plan/` (`Entity/`, `Enum/`, `Repository/`, `Dto/`, `Query/` with
  `GetPlanDocumentQuery`, its handler and `PlanDocumentResult`, `Controller/Api/` with
  `GetPlanDocumentController`, and
  `PlanDocumentReader` (entities → DTOs), `PlanFactory` (DTOs → entities), `PlanVersionCopier`
  directly in the area), `src/Fixtures/`; `User/` comes later (its `Entity/` in the main EM).
  Rules for new code: every area has an `Entity/` folder with **only** entities and their
  embeddables (mappings and `EntityMappingTest` go per folder), enums and other classes beside
  it (`Enum/`); a message and its handler lie side by side in `Command/` resp. `Query/` (with
  the query's result); one controller per endpoint, with an `__invoke` action, named after the
  message it sends (`GetPlanDocumentQuery` → `GetPlanDocumentController`, a later PATCH e.g.
  `UpdatePlanDocumentCommand` → `UpdatePlanDocumentController`), carrying its route and OpenAPI
  attributes on `__invoke`; controllers of `/api` endpoints lie flat in `Controller/Api/`, so the
  folder follows the path (subfolders per resource only once an area has many endpoints;
  controllers of pages, when there are any, beside it in the area's `Controller/`); DTOs hold only DTOs and scalar values, never entities; dependencies
  point one way (`Plan` may know `Project`, not the reverse; `Core` knows no area). Tests mirror
  the folders (`tests/Core/Tenancy/…`, `tests/Plan/Controller/Api/…`).
- **Backend uses CQRS** following `docs/architecture/cqrs.md`, with separate Messenger
  `command.bus` / `query.bus`. Queries
  return DTOs and never modify state. Name commands after business tasks, not field
  setters. Both buses are configured in `config/packages/messenger.yaml`, and both are
  synchronous for now (no async transport or worker yet). Pin each handler to its bus
  with `#[AsMessageHandler(bus: 'command.bus'|'query.bus')]`. Command handlers only
  `persist()`, because the `doctrine_transaction` middleware flushes and commits. Query
  handlers read entities through repositories and return DTOs. **Entities and repositories,
  not native SQL:** handlers and readers load through one `ServiceEntityRepository` per entity
  in the area's `Repository/` folder (named in the entity's `repositoryClass`, no
  interfaces), with finders of their own where `find`/`findBy` is not enough (e.g.
  `findByPlanVersion`); DBAL or SQL only for a measured reason, and only after asking. Load
  what a read needs in a fixed number of queries (fetch joins instead of a lazy load per
  entity). A UUID parameter of a DQL query is bound as `setParameter(…, $uuid,
  UuidType::NAME)`: an entity or a `Uuid` without the type is not bound as BINARY(16) and
  silently matches nothing (`findBy` is fine). Two entity managers: `tenant` (the default, so
  plain `EntityManagerInterface`/`Connection` autowiring and `doctrine_transaction` hit the
  tenant's database) maps `src/Plan/Entity` (mapping `Plan`) and `src/Project/Entity`
  (`Project`); `main` (app_main) maps `src/Core/Tenancy/Entity` (`Tenancy`). A new area's
  `Entity/` folder needs a mapping of its own and a row in `EntityMappingTest`. Tenancy code
  lives in `src/Core/Tenancy`
  (`TenantConnection` refuses queries before a tenant is selected, `TenantSwitcher`,
  `TenantProvisioner`, console `--tenant` option in `Console/Application`, used by
  `bin/console`). The reference example is
  `CreateProjectCommand`/`GetProjectQuery` in `src/Project/Command/` and `Query/`, tested in `tests/Project/ProjectCqrsTest.php`.
- **Migrations** are split: `migrations/Tenant` (bundle default; `doctrine:migrations:diff
  --tenant=demo`) and `migrations/Main` (`--em=main --configuration=config/migrations/main.yaml`).
  After a new migration, run `composer db:migrate` in the `php` container, and again with
  `-e APP_ENV=test`.
- The editor build writes `editor/[name].js` without hashes, because Symfony
  (AssetMapper) is meant to handle cache-busting. Integration of the built editor into
  Twig is not wired up yet.

Still open, to be decided before building complex editing tools: coordinate units and
precision, when a snap becomes a real shared-vertex connection, how transforms and
groups are stored, and document schema versioning/migrations.

Work in small, well-scoped increments that follow existing conventions (e.g. "build a
`CircleEditor` like the `LineEditor`, mutating the model only via commands").

## Editor

See `depts/editor/CLAUDE.md` (loaded when working in `depts/editor/`): current state, interaction
model and its deviations from AutoCAD, commands, code structure, settings, translations.

## git
For now, we can just work in the main-branch directly and commits to git will happen manually.

## Workflow
One developer works on this project alone, one chat at a time: no parallel chats or
sessions, no worktrees. Work sequentially in this folder on main; there is no need to
guard against concurrent edits or to split work across parallel sessions.
