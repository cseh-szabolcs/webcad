# webcad
CAD-Editor with project management functionality for architects

## Databases and migrations

The backend is multi-tenant: every customer (tenant) has a database of its own. Details in
[docs/architecture/tenancy.md](docs/architecture/tenancy.md).

| Database     | Contents                                    | Entities                 | Migrations          | Test database      |
|--------------|---------------------------------------------|--------------------------|---------------------|--------------------|
| `app_main`   | tenant registry, later the users            | `src/Domain/Main/Entity` | `migrations/Main`   | `app_main_test`    |
| `app_<name>` | the data of one customer (projects, plans…) | `src/Domain/Entity`      | `migrations/Tenant` | `app_<name>_test`  |

All commands run in the `php` container. A command on a tenant database selects the tenant with
`--tenant=<name>`; without it, `DEFAULT_TENANT` from `.env.dev` / `.env.test` (`demo`) is used.
Commands on `app_main` always take `--em=main --configuration=config/migrations/main.yaml`.

### First setup

```sh
docker compose up -d
docker compose exec php bin/console doctrine:database:create --connection=main --if-not-exists
docker compose exec php composer db:migrate:main
docker compose exec php bin/console app:tenant:create demo --display-name=Demo
```

`app:tenant:create` creates the tenant database and runs all tenant migrations on it, so a new
tenant never needs a migration run of its own. For the test databases, run the same with
`--env=test` (or `-e APP_ENV=test` before `php` for the composer script):

```sh
docker compose exec php bin/console doctrine:database:create --connection=main --if-not-exists --env=test
docker compose exec -e APP_ENV=test php composer db:migrate:main
docker compose exec php bin/console app:tenant:create demo --env=test
```

### Sample data (dev only)

`app:fixture:create` resets the local tenant database and fills it with the sample plan the editor
is developed with:

```sh
docker compose exec php bin/console app:fixture:create
```

It asks first, then drops every table of the tenant (`demo`, or the one named with
`--tenant=<name>`), builds the schema again from the tenant migrations, and creates the project
"Beispielprojekt" with the plan from `fixtures/plans/sample-plan.json`. The plan gets the id the
editor loads in dev when the URL names no plan, so afterwards http://localhost:8081 shows it; the
command also prints the link.

| Option                | Meaning                                                       |
|-----------------------|---------------------------------------------------------------|
| `-f`, `--force`       | skip the confirmation (needed without interaction)            |
| `--project-name=<…>`  | name of the project (default: `Beispielprojekt`)              |
| `--plan-id=<uuid>`    | another id for the plan (default: the editor's dev plan id)   |

All data of the tenant is lost, so run it only on a local database. The command exists only in
the `dev` environment (and in `test`, for its own test), never in `prod`.

### Creating a migration

Change or add the entity first, then let Doctrine compare the mapping with an **up-to-date**
database (run the pending migrations before, or the diff repeats them).

**Tenant database** (entity in `src/Domain/Entity`), compared with the tenant `demo`:

```sh
docker compose exec php bin/console doctrine:migrations:diff --tenant=demo
```

**Main database** (entity in `src/Domain/Main/Entity`):

```sh
docker compose exec php bin/console doctrine:migrations:diff --em=main --configuration=config/migrations/main.yaml
```

The new class lands in `migrations/Tenant` resp. `migrations/Main`. Check it, give it a
description (`getDescription()`), and run it. For a migration written by hand (e.g. data changes),
`doctrine:migrations:generate` creates an empty one, with the same options.

Use the `diff` commands above rather than `make:migration`, which cannot target the main migration
set.

### Running migrations

| What                       | Command                                                                                            |
|----------------------------|----------------------------------------------------------------------------------------------------|
| everything                 | `composer db:migrate` (first `app_main`, then every tenant)                                       |
| `app_main` only            | `composer db:migrate:main`                                                                         |
| every tenant               | `composer db:migrate:tenants` (= `bin/console app:tenants:run doctrine:migrations:migrate`)        |
| one tenant                 | `bin/console doctrine:migrations:migrate --tenant=<name>`                                          |
| test databases             | the same with `-e APP_ENV=test` (`docker compose exec -e APP_ENV=test php composer db:migrate`)  |

Prefix each with `docker compose exec php`. After pulling new migrations, run `composer db:migrate`
for dev and for test.

### Status and rollback

```sh
docker compose exec php bin/console doctrine:migrations:status --tenant=<name>
docker compose exec php bin/console app:tenants:run "doctrine:migrations:status"
docker compose exec php bin/console doctrine:migrations:status --em=main --configuration=config/migrations/main.yaml

# one step back (needs a working down())
docker compose exec php bin/console doctrine:migrations:migrate prev --tenant=<name>
docker compose exec php bin/console doctrine:migrations:migrate prev --em=main --configuration=config/migrations/main.yaml
```

`app:tenants:run` stops at the first tenant that fails; `--continue-on-error` goes on with the
others and lists every result at the end.

## API documentation and editor types

The PHP API models (`src/Application/Model/`) and the `#[OA\…]` attributes on the controllers are
the only source of the API description. NelmioApiDocBundle builds the OpenAPI document from them
(with the corrections of the processors in `src/OpenApi/`); in dev and test it is served at

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

`schema.d.ts` is checked in and never edited by hand. A change to an API model is only done once
the types were generated again and the diff of `schema.d.ts` is committed with it. The editor uses
the types as `ApiSchema['…']` (`src/api/types.ts`), e.g. `ApiSchema['PlanDocument']` in
`CadApiClient`; `tsc` (`npm run build`) fails when they no longer fit the editor's document model.
