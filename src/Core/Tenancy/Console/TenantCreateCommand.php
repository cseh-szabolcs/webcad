<?php

namespace App\Core\Tenancy\Console;

use App\Core\Tenancy\TenantProvisioner;
use Symfony\Component\Console\Attribute\Argument;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:tenant:create',
    description: 'Create a tenant: register it in app_main and build its database app_<hash>',
)]
final readonly class TenantCreateCommand
{
    public function __construct(
        private TenantProvisioner $provisioner,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Argument('Name people log in with, e.g. "Müller Architekten"')]
        string $name,
        #[Option('Internal id and database name: lowercase letters and digits (default: a random one)')]
        ?string $hash = null,
    ): int {
        $tenant = $this->provisioner->create($name, $hash);

        $io->success(\sprintf(
            'Tenant "%s" created, slug "%s", hash "%s", database "%s".',
            $tenant->getName(),
            $tenant->getSlug(),
            $tenant->getHash(),
            $this->provisioner->databaseName($tenant->getHash()),
        ));

        return Command::SUCCESS;
    }
}
