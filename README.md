# webcad
CAD-Editor with project management functionality for architects

## Databases

The backend is multi-tenant: every customer (tenant) has a database of its own. Details in
[docs/architecture/tenancy.md](docs/architecture/tenancy.md).

| Database     | Contents                                        | Entities                                                   | Test database      |
|--------------|-------------------------------------------------|------------------------------------------------------------|--------------------|
| `app_main`   | tenant registry, tokens (later)                 | `src/Core/Tenancy/Entity`, `src/Security/Entity`           | `app_main_test`    |
| `app_<name>` | the data of one customer (users, projects, plans…) | `src/User/Entity`, `src/Project/Entity`, `src/Plan/Entity` | `app_<name>_test`  |

**No migrations during this early phase:** the schema is built from the entities
(`doctrine:schema:create`). After changing an entity, rebuild the databases; all data is lost.
`migrations/Main` and `migrations/Tenant` stay empty until the schema settles.

All commands run in the `php` container. A command on a tenant database selects the tenant with
`--tenant=<name>`; without it, `DEFAULT_TENANT` from `.env.dev` / `.env.test` (`demo`) is used.

### Setup and rebuild (dev and test only)

```sh
docker compose up -d
docker compose exec php bin/console app:database:rebuild        # asks first; -f / composer db:rebuild skip that
docker compose exec php bin/console app:database:rebuild -f --env=test
```

`app:database:rebuild` drops `app_main` and every tenant database of the environment (dev leaves
the `_test` databases alone and the reverse), builds the `app_main` schema from its entities,
creates the tenant `demo` (`--tenant-name`, `--display-name`) and fills it with
`app:fixture:create` (`--skip-fixtures` leaves it empty). Afterwards you can log in at
http://localhost:8080/de/login with the office `demo` and the user printed by the command.

`app:tenant:create <name>` creates a further tenant: the registry row, the database and its schema.

### Sample data (dev only)

`app:fixture:create` resets the local tenant database and fills it with the sample plan the editor
is developed with and a user to log in with:

```sh
docker compose exec php bin/console app:fixture:create
```

It asks first, then drops every table of the tenant (`demo`, or the one named with
`--tenant=<name>`), builds the schema again from the entities, and creates the project
"Beispielprojekt" with the plan from `fixtures/plans/sample-plan.json` and a user (role
`ROLE_USER`). The plan gets the id the editor loads in dev when the URL names no plan, so
afterwards http://localhost:8081 shows it (after logging in at :8080); the command also prints the link.

| Option                 | Meaning                                                            |
|------------------------|--------------------------------------------------------------------|
| `-f`, `--force`        | skip the confirmation (needed without interaction)                 |
| `--project-name=<…>`   | name of the project (default: `Beispielprojekt`)                   |
| `--plan-id=<uuid>`     | another id for the plan (default: the editor's dev plan id)        |
| `--user-email=<…>`     | e-mail of the user (default: `FixtureCreateCommand::DEV_USER_EMAIL`) |
| `--user-password=<…>`  | password of the user (default: `FixtureCreateCommand::DEV_USER_PASSWORD`) |

All data of the tenant is lost, so run it only on a local database. Both commands exist only in
the `dev` environment (and in `test`, for their own tests), never in `prod`.

`app:tenants:run "<command>"` runs any console command once per tenant; it stops at the first
tenant that fails, `--continue-on-error` goes on with the others and lists every result at the end.

## API documentation and editor types

The PHP DTOs (`src/Plan/Dto/`) and the `#[OA\…]` attributes on the controllers are the only
source of the API description. NelmioApiDocBundle builds the OpenAPI document from them (with the
corrections of the processors in `src/Core/OpenApi/`, which also drop the `Dto` suffix, so
`PlanDocumentDto` is documented as `PlanDocument`); in dev and test it is served at

| What               | URL                                 |
|--------------------|-------------------------------------|
| Stoplight UI       | http://localhost:8080/_doc          |
| OpenAPI document   | http://localhost:8080/_doc.json     |

The editor's TypeScript types are generated from that document into
`depts/editor/src/api/schema.d.ts` (by `depts/editor/scripts/generate-api-types.mjs`, with
openapi-typescript). Run it on the host, with the backend running:

```sh
cd depts/editor
npm run generate:api
# another source: API_DOC_URL=http://… npm run generate:api
```

`schema.d.ts` is checked in and never edited by hand. A change to the DTOs is only done once
the types were generated again and the diff of `schema.d.ts` is committed with it. The editor uses
the types as `ApiSchema['…']` (`src/api/types.ts`); its document model (`src/cad/model`) consists of
aliases of them, so `tsc` (`npm run build`) shows every place a DTO change affects.
