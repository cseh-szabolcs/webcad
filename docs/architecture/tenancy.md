Multi-tenancy: one database per customer
========================================

Every customer (tenant) gets a MySQL database of its own. A central database holds the registry of
tenants (and later the tokens).

| Database          | Contents                                              | Test            |
|-------------------|-------------------------------------------------------|-----------------|
| `app_main`        | tenant registry (`tenant`), `token` (for later)       | `app_main_test` |
| `app_<name>`      | everything of one customer: users, projects, plans, … | `app_<name>_test` |

Tenant names are lowercase letters, digits and `_`, start with a letter and have at most 40
characters. `main` and names ending in `_test` are reserved, so no tenant database can collide with
`app_main` or with a test database. The database name is derived from the name (`TenantNaming`,
parameters `app.tenant_database_prefix` / `app.tenant_database_suffix` in `config/services.yaml`)
and not stored. A tenant has an integer id for the foreign keys in `app_main` (e.g. `token.tenant_id`)
and a uuid (`UuidAwareTrait`) as its public id: whatever leaves the server, such as the `tenant`
cookie, names the tenant by its uuid.

Doctrine setup
--------------

`config/packages/doctrine.yaml` has two connections and two entity managers, both on
`DATABASE_URL` (whose database is `app_main`):

- **`tenant`** is the default connection and entity manager. Its wrapper class
  `App\Core\Tenancy\TenantConnection` connects to the selected tenant's database instead
  of `app_main`, and throws `TenantNotSelectedException` while no tenant is selected. So nothing can
  read or write `app_main` by accident. It maps the entity folders of the business areas whose data
  belongs to one customer: `src/Plan/Entity` (mapping `Plan`), `src/Project/Entity` (`Project`) and
  `src/User/Entity` (`User`).
- **`main`** maps `src/Core/Tenancy/Entity` (mapping `Tenancy`) and `src/Security/Entity` (`Security`).
  Inject it explicitly:
  `#[Autowire(service: 'doctrine.orm.main_entity_manager')]`, or the connection as
  `#[Autowire(service: 'doctrine.dbal.main_connection')]`.

Since `tenant` is the default, the CQRS code needs nothing special: command handlers get the tenant
entity manager, query handlers the repositories of the tenant entities, and the
`doctrine_transaction` middleware of `command.bus` wraps the tenant connection. Plain
`EntityManagerInterface`/`Connection` autowiring hits the tenant's database.

A new entity goes into the `Entity/` folder of its business area (`src/<Area>/Entity`, nothing but
entities and their embeddables there). Each such folder belongs to exactly one entity manager: `tenant` if the area's data
belongs to one customer, `main` if it is shared. A new folder gets a mapping of its own under that
entity manager in `config/packages/doctrine.yaml` and a row in
`tests/Core/Tenancy/EntityMappingTest.php`, which checks that each entity is managed by the entity
manager of its folder.

Selecting the tenant
--------------------

`TenantSwitcher::switchTo($name)` looks the tenant up in the registry (`TenantNotFoundException`, a
404, if it is not there), clears the tenant entity manager (ids are only unique inside one database)
and points the tenant connection at its database.

- **Console:** every command takes `--tenant=<name>` (`Console\Application`, used by `bin/console`;
  `TenantConsoleListener` switches).
- **Login:** the user names the office (tenant) in the login form. `UserAuthenticator` switches to
  it before loading the user, since users live in the tenant database; an unknown name fails with
  `TenantNotFoundAuthenticationException` (shown at the office field). On success
  `TenantStorage` stores the tenant's uuid (never its name, which would show the customer and its
  database) in the session and in the cookie `tenant`, which lives as long as the remember-me cookie
  (`app.remember_me_lifetime`), so a remember-me login after the session expired finds its user in
  the right database.
- **Requests:** `TenantRequestListener` (priority 64, after the session, before the firewall)
  selects the stored tenant (`TenantSwitcher::switchToUuid()`): the session's, else the cookie's.
  A guest's request, or a cookie with no tenant's uuid, selects none.
- **API:** `/api/` has a firewall of its own (`api` in `security.yaml`) that shares the login of
  `main` (`context: main`), so the editor (proxied through Vite on :8081, same cookies) uses the
  session of the pages. A guest gets a JSON 401 (`ApiEntryPoint`) instead of the redirect to the
  login form, and the API URL is never stored as the page to return to after logging in.
- **Logout** invalidates the session and deletes the `tenant` cookie (`logout.delete_cookies` in
  `security.yaml`), so no tenant is selected any more. Without a tenant, `UserProvider` finds no
  user (`UserNotFoundException`), so a session or remember-me cookie whose tenant is gone makes a guest.
- **Console default:** `DEFAULT_TENANT` is set in `.env.dev` and `.env.test` only. Without
  `--tenant`, a command uses it. Requests never use it; in production nothing selects a tenant
  implicitly.
- **Tests:** a `KernelTestCase` has neither request nor command, so it calls `switchTo()` itself
  (see `ProjectCqrsTest::setUp()`). A `WebTestCase` logs in with `tests/Security/LogsInTrait.php`
  (`loginUser()` plus the `tenant` cookie).

Creating and deleting tenants
-----------------------------

The commands (`app:tenant:create|list|delete`) are listed in `CLAUDE.md` and `README.md`.
`TenantProvisioner::create()` writes the registry row, creates the database and builds its schema
from the tenant entities (`doctrine:schema:create`). If a step fails, the
database and the row are removed again. A database of that name that belongs to no tenant is never
touched: creating the tenant is refused.

Schema, no migrations (yet)
---------------------------

During this early phase the schema is built from the entities, not from migrations:
`app:database:rebuild` (dev and test, `src/Fixtures/Console/`) drops `app_main` and every tenant
database of the environment, runs `doctrine:schema:create --em=main`, creates one tenant and its
fixtures; `TenantProvisioner::reset()` drops a tenant's tables and runs `doctrine:schema:create`
again. After an entity change, rebuild. `migrations/Main` and `migrations/Tenant` (with
`config/migrations/main.yaml` and `config/packages/doctrine_migrations.yaml`) stay configured but
empty until migrations are introduced again.

`app:tenants:run "<command>"` runs any console command once per tenant (`--continue-on-error` to go
on after a failure). `TenantCommandRunner` gives each run a kernel of its own (without a tenant, for
`--em=main`), so the calling kernel's entity managers stay untouched and single-use services such
as the migrations' `DependencyFactory` start fresh.

Database privileges
-------------------

The `app` user needs `CREATE`/`DROP` on every `app_%` database.
`docker/map/mysql-init.sql` grants it when the `db-data` volume is created. For an older volume, run
it once as root:

```sh
docker compose exec -T db mysql -uroot -proot < docker/map/mysql-init.sql
```
