<?php

namespace App\Fixtures\Console;

use App\Core\Tenancy\TenantCommandRunner;
use App\Core\Tenancy\TenantNaming;
use App\Core\Tenancy\TenantProvisioner;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\DependencyInjection\Attribute\When;

/**
 * Development setup from scratch: drops app_main and every tenant database of the environment
 * (app_<name> in dev, app_<name>_test in test), builds the app_main schema from its entities
 * (doctrine:schema:create, no migrations during this early phase), creates one tenant and fills it
 * with app:fixture:create. Registered in dev only (and in test, for its test), never in prod.
 */
#[When(env: 'dev')]
#[When(env: 'test')]
#[AsCommand(
    name: 'app:database:rebuild',
    description: 'Drop all databases and build them again from the entities, with one tenant and its fixtures',
)]
final readonly class DatabaseRebuildCommand
{
    private const string CREATE_MAIN_SCHEMA = 'doctrine:schema:create --em=main';
    private const string CREATE_FIXTURES = 'app:fixture:create --force';

    public function __construct(
        #[Autowire(service: 'doctrine.dbal.main_connection')]
        private Connection $mainConnection,
        #[Autowire(service: 'doctrine.orm.main_entity_manager')]
        private EntityManagerInterface $mainEntityManager,
        private TenantNaming $naming,
        private TenantProvisioner $provisioner,
        private TenantCommandRunner $commandRunner,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Option('Name of the tenant to create')]
        string $tenantName = 'demo',
        #[Option('Name of the tenant shown to people')]
        string $displayName = 'Demo',
        #[Option('Create the tenant without the sample data and user of app:fixture:create')]
        bool $skipFixtures = false,
        #[Option('Skip the confirmation (required without interaction)', shortcut: 'f')]
        bool $force = false,
    ): int {
        $mainDatabase = $this->mainConnection->getParams()['dbname'];
        $schemaManager = $this->mainConnection->createSchemaManager();
        $tenantDatabases = array_values(array_filter(
            $schemaManager->listDatabases(),
            fn (string $database) => null !== $this->naming->tenantName($database),
        ));

        $io->warning(\sprintf('This deletes the databases %s.', implode(', ', [$mainDatabase, ...$tenantDatabases])));
        if (!$force && !$io->confirm('Rebuild all databases?', false)) {
            $io->note('Aborted, nothing was changed.');

            return Command::SUCCESS;
        }

        foreach ($tenantDatabases as $database) {
            $schemaManager->dropDatabase($database);
        }
        if (\in_array($mainDatabase, $schemaManager->listDatabases(), true)) {
            $schemaManager->dropDatabase($mainDatabase);
        }
        $schemaManager->createDatabase($mainDatabase);
        // Reconnect to the new database; nothing loaded before exists any more
        $this->mainConnection->close();
        $this->mainEntityManager->clear();

        $this->run(null, self::CREATE_MAIN_SCHEMA, $io);
        $this->provisioner->create($tenantName, $displayName);
        $io->writeln(\sprintf('Tenant "%s" created.', $tenantName));

        if (!$skipFixtures) {
            $this->run($tenantName, self::CREATE_FIXTURES, $io);
        }

        $io->success('All databases rebuilt.');

        return Command::SUCCESS;
    }

    private function run(?string $tenant, string $commandLine, SymfonyStyle $io): void
    {
        if (Command::SUCCESS !== $this->commandRunner->run($tenant, $commandLine, $io)) {
            throw new \RuntimeException(\sprintf('"%s" failed.', $commandLine));
        }
    }
}
