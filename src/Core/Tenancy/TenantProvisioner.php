<?php

namespace App\Core\Tenancy;

use App\Core\Component\String\NanoId;
use App\Core\Component\String\Slug;
use App\Core\Tenancy\Entity\Tenant;
use App\Core\Tenancy\Exception\InvalidTenantHashException;
use App\Core\Tenancy\Exception\TenantNotFoundException;
use App\Core\Tenancy\Exception\TenantProvisioningException;
use App\Core\Tenancy\Repository\TenantRepository;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Schema\Name\UnqualifiedName;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Output\BufferedOutput;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Creates, resets and deletes tenants: the registry row in app_main and the database
 * <prefix><hash><suffix>, e.g. app_k3x9q2mf (dev) or app_k3x9q2mf_test (test). A new or reset
 * database gets its schema from the tenant entities (doctrine:schema:create); there are no
 * migrations during this early phase of development.
 *
 * Hashes have lowercase letters and digits only and "main" is reserved, so no tenant database can be
 * app_main or end in "_test" (the test database of another tenant), and none needs quoting.
 */
final readonly class TenantProvisioner
{
    /** Length of a generated hash, a NanoID of lowercase letters and digits */
    public const int HASH_LENGTH = 8;

    private const string CREATE_SCHEMA = 'doctrine:schema:create';
    private const string DROP_TABLES = 'doctrine:schema:drop --full-database --force';
    private const string HASH_PATTERN = '/^[a-z0-9]+$/';
    private const string RESERVED_HASH = 'main';

    public function __construct(
        #[Autowire(service: 'doctrine.orm.main_entity_manager')]
        private EntityManagerInterface $mainEntityManager,
        #[Autowire(service: 'doctrine.dbal.main_connection')]
        private Connection $mainConnection,
        private TenantRepository $tenantRepository,
        private TenantCommandRunner $commandRunner,
        #[Autowire(param: 'app.tenant_database_prefix')]
        private string $databasePrefix,
        #[Autowire(param: 'app.tenant_database_suffix')]
        private string $databaseSuffix,
    ) {
    }

    /**
     * The name is not checked: that belongs to whoever takes it in (the registration, later).
     *
     * @param string|null $hash the tenant's internal id and database name, null for a random one
     *
     * @throws InvalidTenantHashException
     * @throws TenantProvisioningException when the tenant or its database exists, or building it failed
     */
    public function create(string $name, ?string $hash = null): Tenant
    {
        $slug = Slug::create($name, Tenant::SLUG_SEPARATOR, Tenant::SLUG_LOCALE);
        if ($this->tenantRepository->findBySlug($slug) instanceof Tenant) {
            throw TenantProvisioningException::tenantExists($slug);
        }

        $schemaManager = $this->mainConnection->createSchemaManager();
        $databases = $this->databaseNames();
        $hash ??= $this->uniqueHash($databases);
        $this->assertValidHash($hash);

        $database = $this->databaseName($hash);
        if ($this->tenantRepository->findByHash($hash) instanceof Tenant) {
            throw TenantProvisioningException::tenantExists($hash);
        }
        if (\in_array($database, $databases, true)) {
            throw TenantProvisioningException::databaseExists($database);
        }

        // The row first: the schema command selects the tenant by hash, which looks it up in the registry.
        $tenant = new Tenant($name, $slug, $hash);
        $this->mainEntityManager->persist($tenant);
        $this->mainEntityManager->flush();

        try {
            $schemaManager->createDatabase($database);
        } catch (\Throwable $e) {
            $this->removeFromRegistry($tenant);

            throw TenantProvisioningException::fromThrowable('CREATE DATABASE', $e, '');
        }

        try {
            $this->createSchema($hash);
        } catch (TenantProvisioningException $e) {
            // No half-built tenant: a leftover row would point at a database without schema.
            $schemaManager->dropDatabase($database);
            $this->removeFromRegistry($tenant);

            throw $e;
        }

        return $tenant;
    }

    /**
     * Empties the tenant's database: drops every table and builds the schema again from the
     * entities. The database itself stays, so open connections keep working.
     *
     * @throws TenantNotFoundException
     * @throws TenantProvisioningException when dropping or creating the schema failed
     */
    public function reset(string $hash): void
    {
        if (!$this->tenantRepository->findByHash($hash) instanceof Tenant) {
            throw new TenantNotFoundException($hash);
        }

        $this->run($hash, self::DROP_TABLES);
        $this->createSchema($hash);
    }

    /**
     * Drops the tenant's database and removes it from the registry.
     *
     * @throws TenantNotFoundException
     */
    public function delete(string $hash): void
    {
        $tenant = $this->tenantRepository->findByHash($hash) ?? throw new TenantNotFoundException($hash);
        $database = $this->databaseName($hash);

        $schemaManager = $this->mainConnection->createSchemaManager();
        if (\in_array($database, $this->databaseNames(), true)) {
            $schemaManager->dropDatabase($database);
        }

        $this->removeFromRegistry($tenant);
    }

    /**
     * Every database of the server, of any tenant or not.
     *
     * @return list<string>
     */
    public function databaseNames(): array
    {
        return array_map(
            static fn (UnqualifiedName $name) => $name->getIdentifier()->getValue(),
            $this->mainConnection->createSchemaManager()->introspectDatabaseNames(),
        );
    }

    /**
     * The database of a tenant's hash. Checks nothing: the hash is a registered tenant's.
     */
    public function databaseName(string $hash): string
    {
        return $this->databasePrefix.$hash.$this->databaseSuffix;
    }

    /**
     * The hash of the tenant a database belongs to, the reverse of databaseName(); null for a
     * database that is no tenant database of this environment (app_main, another environment's).
     */
    public function tenantHash(string $database): ?string
    {
        if (!str_starts_with($database, $this->databasePrefix) || !str_ends_with($database, $this->databaseSuffix)) {
            return null;
        }

        $hash = substr($database, \strlen($this->databasePrefix), \strlen($database) - \strlen($this->databasePrefix) - \strlen($this->databaseSuffix));

        return $this->isValidHash($hash) && $database === $this->databaseName($hash) ? $hash : null;
    }

    /**
     * A hash no tenant and no database has yet.
     *
     * @param list<string> $databases
     */
    private function uniqueHash(array $databases): string
    {
        do {
            $hash = NanoId::generate(self::HASH_LENGTH);
        } while ($this->tenantRepository->findByHash($hash) instanceof Tenant
            || \in_array($this->databaseName($hash), $databases, true));

        return $hash;
    }

    /**
     * @throws InvalidTenantHashException
     */
    private function assertValidHash(string $hash): void
    {
        if (!$this->isValidHash($hash)) {
            throw new InvalidTenantHashException(\sprintf('Invalid tenant hash "%s": only lowercase letters and digits, at most %d characters, not "%s".', $hash, Tenant::HASH_MAX_LENGTH, self::RESERVED_HASH));
        }
    }

    private function isValidHash(string $hash): bool
    {
        return \strlen($hash) <= Tenant::HASH_MAX_LENGTH
            && 1 === preg_match(self::HASH_PATTERN, $hash)
            && self::RESERVED_HASH !== $hash;
    }

    /**
     * @throws TenantProvisioningException
     */
    private function createSchema(string $hash): void
    {
        $this->run($hash, self::CREATE_SCHEMA);
    }

    /**
     * @throws TenantProvisioningException
     */
    private function run(string $hash, string $commandLine): void
    {
        $output = new BufferedOutput();

        try {
            $exitCode = $this->commandRunner->run($hash, $commandLine, $output);
        } catch (\Throwable $e) {
            throw TenantProvisioningException::fromThrowable($commandLine, $e, $output->fetch());
        }

        if (0 !== $exitCode) {
            throw TenantProvisioningException::fromExitCode($commandLine, $exitCode, $output->fetch());
        }
    }

    private function removeFromRegistry(Tenant $tenant): void
    {
        $this->mainEntityManager->remove($tenant);
        $this->mainEntityManager->flush();
    }
}
