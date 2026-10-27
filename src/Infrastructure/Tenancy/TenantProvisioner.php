<?php

namespace App\Infrastructure\Tenancy;

use App\Domain\Main\Entity\Tenant;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Output\BufferedOutput;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Creates and deletes tenants: the registry row in app_main and the database app_<name>. A new
 * database gets its schema from the tenant migrations, so they stay the only source of the schema.
 */
final readonly class TenantProvisioner
{
    private const string MIGRATE = 'doctrine:migrations:migrate --allow-no-migration';

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
        $output = new BufferedOutput();

        try {
            $exitCode = $this->commandRunner->run($name, self::MIGRATE, $output);
        } catch (\Throwable $e) {
            throw TenantProvisioningException::fromThrowable(self::MIGRATE, $e, $output->fetch());
        }

        if (0 !== $exitCode) {
            throw TenantProvisioningException::fromExitCode(self::MIGRATE, $exitCode, $output->fetch());
        }
    }

    private function removeFromRegistry(Tenant $tenant): void
    {
        $this->mainEntityManager->remove($tenant);
        $this->mainEntityManager->flush();
    }
}
