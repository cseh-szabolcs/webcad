<?php

namespace App\Core\Tenancy\Console;

use App\Core\Tenancy\Repository\TenantRepository;
use App\Core\Tenancy\TenantProvisioner;
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
        private TenantProvisioner $provisioner,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $rows = [];
        foreach ($this->tenantRepository->findAllOrdered() as $tenant) {
            $rows[] = [$tenant->getName(), $tenant->getSlug(), $tenant->getHash(), $this->provisioner->databaseName($tenant->getHash())];
        }

        if ([] === $rows) {
            $io->note('No tenants yet, create one with app:tenant:create.');

            return Command::SUCCESS;
        }

        $io->table(['Name', 'Slug', 'Hash', 'Database'], $rows);

        return Command::SUCCESS;
    }
}
