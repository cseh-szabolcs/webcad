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
  AssetMapper and Stimulus are installed. Pages so far: the home page (`/{_locale}`) and the
  login and registration forms (`/{_locale}/login`, `/{_locale}/register`), which only display
  and validate; logging in and registering come later.
- **CAD editor frontend** in `depts/editor/`: Vite + React 19 + TypeScript + Paper.js,
  **being rebuilt from scratch, closer to AutoCAD behaviour**, in small steps. It loads a plan
  through the API and draws and edits it (selection, snapping, tracking, drawing commands,
  MOVE, undo/redo); changes are not saved to the backend yet. **Everything about the editor
  (state, structure, rules, reference material) is in `depts/editor/CLAUDE.md`**, its user
  guide in `depts/editor/docs/bedienung.md`.

### Reference material (read, don't copy)

- **`depts/editor-old/`** (previous editor) and **`depts/demo1/`** (OSNAP reference): see
  `depts/editor/CLAUDE.md`; for comparison only, never imported.
- **`docs/`**: `docs/todo/setup.md` (architecture concept, German) and `docs/architecture/`
  (see "Architecture" below).
- **`depts/editor/docs/bedienung.md`**: user guide of the editor (German); keep it in sync
  when the controls change (rules in `depts/editor/CLAUDE.md`).

## Running it (Docker)

Everything runs through `compose.yml`. Run PHP tooling inside the `php` container, not
on the host. This overrides the `symfony serve -d` advice in AGENTS.md.

```sh
docker compose up -d
docker compose exec php bin/console <cmd>          # e.g. debug:router, make:*, doctrine:migrations:migrate
docker compose exec php bin/phpunit                # all tests
docker compose exec php bin/phpunit tests/Core/Controller/IndexControllerTest.php
docker compose exec php vendor/bin/php-cs-fixer fix   # @Symfony ruleset (php-cs-fixer/shim)
docker compose exec -T php vendor/bin/mate tools:list # AI Mate diagnostics; always run Mate this way
```

| Service    | URL / port                                                          |
|------------|---------------------------------------------------------------------|
| App        | http://localhost:8080 (nginx → php-fpm, document root `public/`; `/` redirects to `/de`) |
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

The sample plan exists twice, `fixtures/plans/sample-plan.json` (backend) and
`depts/editor/src/cad/__fixtures__/sample-plan.json` (editor tests): **keep them
byte-identical** (details in `docs/architecture/plan-persistence.md`). In dev the editor loads
it under `DEV_PLAN_ID` (`01994f4e-6f3a-7c2d-9b1e-5a3c2d1e0f42`), which `app:fixture:create`
creates.

The `php` container mounts a named volume over `/app/depts`, so the editor sources are not
visible from inside `php`.

**Node tooling runs on the host** (`npm install`, `npm test`, `npm run lint|build`, run
inside `depts/editor/` or `depts/editor-old/`); the `editor`/`editor-old` containers only serve
Vite. Details (native bindings, `.npmrc`, Vite proxy) in `depts/editor/CLAUDE.md`. Model
coordinates are **mm with Y up** in editor and backend alike.

## Architecture

The design concept is in `docs/todo/setup.md` (German). Details live in `docs/architecture/`;
read the matching file before working in its area:

| File | Covers |
|---|---|
| `plan-persistence.md` | why plans are stored as they are (relational, versioned, draft/head, publishing), plan vs. plan document, pitfalls (sample plan copies, `app:fixture:create`), `json_document`, what is planned or open |
| `api-documentation.md` | DTOs, Nelmio rules, OpenAPI processors, generating the editor's types |
| `tenancy.md` | one database per customer, the two entity managers and their mappings, selecting the tenant, tenant commands, migrations |
| `cqrs.md` | commands, queries, handlers, buses, repositories instead of SQL, with the Project example |

Rules that apply everywhere:

- **The persisted CAD document is independent of Paper.js, React and the editor tools.**
  Store what the user defined (vertices, elements, layers, groups, styles); compute what can
  be derived (midpoints, intersections, bounding boxes, snap candidates, selection/hover state
  are never saved). The editor's own architecture is in `depts/editor/CLAUDE.md`.
- **Backend layout by business area**, not by layer; namespaces follow the folders:
  `src/Core/` is technology only (`Tenancy/`, `Doctrine/`, `OpenApi/`,
  `Controller/IndexController` for the home page), `src/Project/`, `src/Plan/`,
  `src/Fixtures/`, `src/User/` (login and registration pages, `Form/`; its `Entity/` comes later,
  in the main EM). Per area:
  - `Entity/` holds **only** entities and their embeddables (mapped per folder: a new folder
    needs a mapping in `config/packages/doctrine.yaml` and a row in `EntityMappingTest`), enums
    and other classes beside it (`Enum/`); `Repository/` one `ServiceEntityRepository` per entity.
  - `Command/` and `Query/`: a message and its handler side by side (with the query's result).
  - `Dto/`: the DTOs of the area's API, suffix **`Dto`** (never `DTO`: PHP class names are
    case-insensitive), holding only DTOs and scalar values, never entities.
  - `Controller/Api/`: one controller per `/api` endpoint, flat, with an `__invoke` action that
    carries its route and OpenAPI attributes, named after the message it sends
    (`GetPlanDocumentQuery` → `GetPlanDocumentController`, a later PATCH e.g.
    `UpdatePlanDocumentCommand` → `UpdatePlanDocumentController`); subfolders per resource only
    once an area has many endpoints, page controllers beside it in `Controller/`. It returns an
    `ApiResponse` (`src/Core/Http/`: data, ETag, serializer context, status), which
    `ControllerResultListener` serializes like `AbstractController::json()` (ETag → 304 on a
    matching `If-None-Match`); query results stay free of HTTP.
  - Dependencies point one way (`Plan` may know `Project`, not the reverse; `Core` knows no
    area). Tests mirror the folders (`tests/Core/Tenancy/…`, `tests/Plan/Controller/Api/…`).
- **CQRS** with separate Messenger `command.bus` / `query.bus` (`docs/architecture/cqrs.md`):
  queries return DTOs and never modify state; commands are named after business tasks; command
  handlers only `persist()` (the `doctrine_transaction` middleware flushes); handlers pinned to
  their bus with `#[AsMessageHandler(bus: …)]`.
- **Entities and repositories, not native SQL**: DBAL or SQL only for a measured reason, and
  only after asking; a read needs a fixed number of queries (fetch joins). DQL UUID parameters
  need `UuidType::NAME`, or they silently match nothing.
- **Two entity managers**: `tenant` (default; `src/Plan/Entity`, `src/Project/Entity`) and
  `main` (app_main; `src/Core/Tenancy/Entity`). `TenantConnection` refuses queries before a
  tenant is selected; a `KernelTestCase` selects it with `TenantSwitcher` itself.
- **Plans** are stored relationally and versioned (`Plan` → draft/head `PlanVersion` → content
  entities); display values are columns of the element subclasses. A new display value is a
  field, a migration and a DTO field. The *plan document* (the drawing of one version) exists
  only as `PlanDocumentDto` (`PlanDocumentReader` ↔ `PlanFactory`).
- **API**: the DTOs and controller attributes are the only source of the OpenAPI document; a DTO
  change is done only once `npm run generate:api` ran and the diff of
  `depts/editor/src/api/schema.d.ts` is committed with it. The OpenAPI schema names drop the
  `Dto` suffix, so `ApiSchema['PlanDocument']` stays stable.
- **Migrations** are split: `migrations/Tenant` (`doctrine:migrations:diff --tenant=demo`) and
  `migrations/Main` (`--em=main --configuration=config/migrations/main.yaml`). After a new
  migration, run `composer db:migrate` in the `php` container, and again with
  `-e APP_ENV=test`. Moving a class stored as `json_document` needs a data migration.
- **Twig pages** (`templates/`, styles in `assets/styles/app.css`): every text goes through
  `|trans` with a key in `translations/messages.de.yaml` (form labels and help are keys too;
  own constraint messages in `validators.de.yaml`). German is the only translation yet;
  `enabled_locales` is `[de, en]` and other locales fall back to German. The locale is the URL
  prefix: page routes are `/{_locale}/…` with `requirements: ['_locale' => '%app.locales%']`
  (`config/services.yaml`, keep in line with `enabled_locales`); the switcher in
  `templates/layout/` links the current route in every enabled locale. Forms use
  `templates/form/theme.html.twig`. No web fonts from third parties (system font stacks). The public
  pages are light only; dark mode belongs to the later layout for logged-in users.
- The editor build writes `editor/[name].js` without hashes, because Symfony (AssetMapper) is
  meant to handle cache-busting. Integration of the built editor into Twig is not wired up yet.

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
