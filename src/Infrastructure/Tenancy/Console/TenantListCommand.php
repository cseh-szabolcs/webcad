<?php

namespace App\Infrastructure\Tenancy\Console;

use App\Infrastructure\Tenancy\TenantNaming;
use App\Infrastructure\Tenancy\TenantRepository;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:tenant:list',
    description: 'List the tenants and their databases',
)]
final readonly class TenantListCommand
{
    public function __construct(
        private TenantRepository $tenantRepository,
        private TenantNaming $naming,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $rows = [];
        foreach ($this->tenantRepository->findAllOrdered() as $tenant) {
            $rows[] = [$tenant->getName(), $tenant->getDisplayName(), $this->naming->databaseName($tenant->getName())];
        }

        if ([] === $rows) {
            $io->note('No tenants yet, create one with app:tenant:create.');

            return Command::SUCCESS;
        }

        $io->table(['Name', 'Display name', 'Database'], $rows);

        return Command::SUCCESS;
    }
}
