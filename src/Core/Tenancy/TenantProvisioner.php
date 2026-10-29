<?php

namespace App\Core\Tenancy;

use App\Core\Tenancy\Entity\Tenant;
use App\Core\Tenancy\Repository\TenantRepository;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Output\BufferedOutput;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Creates, resets and deletes tenants: the registry row in app_main and the database app_<name>. A
 * new or reset database gets its schema from the tenant migrations, so they stay the only source of
 * the schema.
 */
final readonly class TenantProvisioner
{
    private const string MIGRATE = 'doctrine:migrations:migrate --allow-no-migration';
    private const string DROP_TABLES = 'doctrine:schema:drop --full-database --force';

    public function __construct(
        #[Autowire(service: 'doctrine.orm.main_entity_manager')]
        private EntityManagerInterface $mainEntityManager,
        #[Autowire(service: 'doctrine.dbal.main_connection')]
        private Connection $mainConnection,
        private TenantRepository $tenantRepository,
        private TenantNaming $naming,
        private TenantCommandRunner $commandRunner,
    ) {
    }

    /**
     * @throws InvalidTenantNameException
     * @throws TenantProvisioningException when the tenant or its database exists, or building it failed
     */
    public function create(string $name, string $displayName): Tenant
    {
        $database = $this->naming->databaseName($name);
        if ($this->tenantRepository->findByName($name) instanceof Tenant) {
            throw TenantProvisioningException::tenantExists($name);
        }

        $schemaManager = $this->mainConnection->createSchemaManager();
        if (\in_array($database, $schemaManager->listDatabases(), true)) {
            throw TenantProvisioningException::databaseExists($database);
        }

        // The row first: the migrations select the tenant by name, which looks it up in the registry.
        $tenant = new Tenant($name, $displayName);
        $this->mainEntityManager->persist($tenant);
        $this->mainEntityManager->flush();

        try {
            $schemaManager->createDatabase($database);
        } catch (\Throwable $e) {
            $this->removeFromRegistry($tenant);

            throw TenantProvisioningException::fromThrowable('CREATE DATABASE', $e, '');
        }

        try {
            $this->migrate($name);
        } catch (TenantProvisioningException $e) {
            // No half-built tenant: a leftover row would point at a database without schema.
            $schemaManager->dropDatabase($database);
            $this->removeFromRegistry($tenant);

            throw $e;
        }

        return $tenant;
    }

    /**
     * Empties the tenant's database: drops every table (the migration versions too) and builds the
     * schema again from the migrations. The database itself stays, so open connections keep working.
     *
     * @throws TenantNotFoundException
     * @throws TenantProvisioningException when dropping or migrating failed
     */
    public function reset(string $name): void
    {
        if (!$this->tenantRepository->findByName($name) instanceof Tenant) {
            throw new TenantNotFoundException($name);
        }

        $this->run($name, self::DROP_TABLES);
        $this->migrate($name);
    }

    /**
     * Drops the tenant's database and removes it from the registry.
     *
     * @throws TenantNotFoundException
     */
    public function delete(string $name): void
    {
        $tenant = $this->tenantRepository->findByName($name) ?? throw new TenantNotFoundException($name);
        $database = $this->naming->databaseName($name);

        $schemaManager = $this->mainConnection->createSchemaManager();
        if (\in_array($database, $schemaManager->listDatabases(), true)) {
            $schemaManager->dropDatabase($database);
        }

        $this->removeFromRegistry($tenant);
    }

    /**
     * @throws TenantProvisioningException
     */
    private function migrate(string $name): void
    {
        $this->run($name, self::MIGRATE);
    }

    /**
     * @throws TenantProvisioningException
     */
    private function run(string $name, string $commandLine): void
    {
        $output = new BufferedOutput();

        try {
            $exitCode = $this->commandRunner->run($name, $commandLine, $output);
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
