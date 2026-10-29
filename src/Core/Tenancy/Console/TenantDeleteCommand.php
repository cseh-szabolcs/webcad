<?php

namespace App\Core\Tenancy\Console;

use App\Core\Tenancy\Repository\TenantRepository;
use App\Core\Tenancy\TenantNaming;
use App\Core\Tenancy\TenantNotFoundException;
use App\Core\Tenancy\TenantProvisioner;
use Symfony\Component\Console\Attribute\Argument;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:tenant:delete',
    description: 'Delete a tenant: drop its database and remove it from app_main',
)]
final readonly class TenantDeleteCommand
{
    public function __construct(
        private TenantProvisioner $provisioner,
        private TenantRepository $tenantRepository,
        private TenantNaming $naming,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Argument('Name of the tenant to delete')]
        string $name,
        #[Option('Skip the confirmation (required without interaction)', shortcut: 'f')]
        bool $force = false,
    ): int {
        $tenant = $this->tenantRepository->findByName($name) ?? throw new TenantNotFoundException($name);

        $io->warning(\sprintf(
            'This drops the database "%s" of tenant "%s" (%s) for good.',
            $this->naming->databaseName($name),
            $name,
            $tenant->getDisplayName(),
        ));

        if (!$force && !$io->confirm('Delete this tenant?', false)) {
            $io->note('Aborted, nothing was deleted.');

            return Command::SUCCESS;
        }

        $this->provisioner->delete($name);

        $io->success(\sprintf('Tenant "%s" deleted.', $name));

        return Command::SUCCESS;
    }
}
