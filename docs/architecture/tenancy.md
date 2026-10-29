Multi-tenancy: one database per customer
========================================

Every customer (tenant) gets a MySQL database of its own. A central database holds the registry of
tenants and, once they exist, the users.

| Database          | Contents                                          | Test            |
|-------------------|---------------------------------------------------|-----------------|
| `app_main`        | tenant registry (`tenant`), later users           | `app_main_test` |
| `app_<name>`      | everything of one customer: projects, plans, …    | `app_<name>_test` |

Tenant names are lowercase letters, digits and `_`, start with a letter and have at most 40
characters. `main` and names ending in `_test` are reserved, so no tenant database can collide with
`app_main` or with a test database. The database name is derived from the name (`TenantNaming`,
parameters `app.tenant_database_prefix` / `app.tenant_database_suffix` in `config/services.yaml`)
and not stored.

Doctrine setup
--------------

`config/packages/doctrine.yaml` has two connections and two entity managers, both on
`DATABASE_URL` (whose database is `app_main`):

- **`tenant`** is the default connection and entity manager. Its wrapper class
  `App\Core\Tenancy\TenantConnection` connects to the selected tenant's database instead
  of `app_main`, and throws `TenantNotSelectedException` while no tenant is selected. So nothing can
  read or write `app_main` by accident. It maps the entity folders of the business areas whose data
  belongs to one customer: `src/Plan/Entity` (mapping `Plan`) and `src/Project/Entity` (`Project`).
- **`main`** maps `src/Core/Tenancy/Entity` (mapping `Tenancy`; later also `src/User/Entity`).
  Inject it explicitly:
  `#[Autowire(service: 'doctrine.orm.main_entity_manager')]`, or the connection as
  `#[Autowire(service: 'doctrine.dbal.main_connection')]`.

Since `tenant` is the default, the CQRS code needs nothing special: command handlers get the tenant
entity manager, query handlers the tenant `Connection`, and the `doctrine_transaction` middleware of
`command.bus` wraps the tenant connection.

A new entity goes into the `Entity/` folder of its business area (`src/<Area>/Entity`, nothing but
entities there). Each such folder belongs to exactly one entity manager: `tenant` if the area's data
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
- **Requests:** there are no users yet. `TenantRequestListener` selects `DEFAULT_TENANT`.
- **Default:** `DEFAULT_TENANT` is set in `.env.dev` and `.env.test` only. Without `--tenant`, a
  command uses it too. In production nothing selects a tenant implicitly.
- **Later:** users live in `app_main`; after login, the user's tenant replaces `DEFAULT_TENANT`
  in `TenantRequestListener`.
- **Tests:** a `KernelTestCase` has neither request nor command, so it calls `switchTo()` itself
  (see `ProjectCqrsTest::setUp()`).

Creating and deleting tenants
-----------------------------

```sh
docker compose exec php bin/console app:tenant:create acme --display-name="Acme AG"
docker compose exec php bin/console app:tenant:list
docker compose exec php bin/console app:tenant:delete acme          # asks; --force without asking
```

`TenantProvisioner::create()` writes the registry row, creates the database and runs the tenant
migrations on it, so the migrations stay the only source of the schema. If a step fails, the
database and the row are removed again. A database of that name that belongs to no tenant is never
touched: creating the tenant is refused.

Migrations
----------

| Set     | Folder              | Run with                                                              |
|---------|---------------------|-----------------------------------------------------------------------|
| tenants | `migrations/Tenant` | bundle default (`config/packages/doctrine_migrations.yaml`), per tenant |
| main    | `migrations/Main`   | `--em=main --configuration=config/migrations/main.yaml`               |

```sh
docker compose exec php composer db:migrate          # db:migrate:main, then db:migrate:tenants
docker compose exec -e APP_ENV=test php composer db:migrate
docker compose exec php bin/console doctrine:migrations:diff --tenant=demo
docker compose exec php bin/console doctrine:migrations:diff --em=main --configuration=config/migrations/main.yaml
```

`app:tenants:run "<command>"` runs any console command once per tenant (`--continue-on-error` to go
on after a failure). `TenantCommandRunner` gives each run a kernel of its own, because the
migrations' `DependencyFactory` remembers the first database it has seen.

Database privileges
-------------------

The `app` user needs `CREATE`/`DROP` on every `app_%` database.
`docker/map/mysql-init.sql` grants it when the `db-data` volume is created. For an older volume, run
it once as root:

```sh
docker compose exec -T db mysql -uroot -proot < docker/map/mysql-init.sql
```
