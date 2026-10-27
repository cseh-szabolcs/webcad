<?php

namespace App\Infrastructure\Tenancy\Console;

use App\Infrastructure\Tenancy\TenantCommandRunner;
use App\Infrastructure\Tenancy\TenantNaming;
use App\Infrastructure\Tenancy\TenantRepository;
use Symfony\Component\Console\Attribute\Argument;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:tenants:run',
    description: 'Run a console command against every tenant database',
)]
final readonly class TenantsRunCommand
{
    public function __construct(
        private TenantRepository $tenantRepository,
        private TenantNaming $naming,
        private TenantCommandRunner $commandRunner,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        OutputInterface $output,
        #[Argument('The command to run per tenant, e.g. "doctrine:migrations:migrate"')]
        string $commandLine,
        #[Option('Go on with the remaining tenants after a failure (default: stop)')]
        bool $continueOnError = false,
    ): int {
        $tenants = $this->tenantRepository->findAllOrdered();
        if ([] === $tenants) {
            $io->note('No tenants yet, nothing to do.');

            return Command::SUCCESS;
        }

        $io->title(\sprintf('Running "%s" for %d tenant(s)', $commandLine, \count($tenants)));

        $results = [];
        $failed = false;
        foreach ($tenants as $tenant) {
            $name = $tenant->getName();
            $database = $this->naming->databaseName($name);
            $io->section(\sprintf('%s (%s)', $name, $database));

            try {
                $exitCode = $this->commandRunner->run($name, $commandLine, $output);
            } catch (\Throwable $e) {
                $io->error($e->getMessage());
                $exitCode = Command::FAILURE;
            }

            $results[] = [$name, $database, Command::SUCCESS === $exitCode ? '<info>ok</info>' : \sprintf('<error>failed (%d)</error>', $exitCode)];

            if (Command::SUCCESS !== $exitCode) {
                $failed = true;
                if (!$continueOnError) {
                    $io->error(\sprintf('Failed for tenant "%s", stopping.', $name));
                    break;
                }
            }
        }

        $io->section('Summary');
        $io->table(['Tenant', 'Database', 'Result'], $results);

        return $failed ? Command::FAILURE : Command::SUCCESS;
    }
}
