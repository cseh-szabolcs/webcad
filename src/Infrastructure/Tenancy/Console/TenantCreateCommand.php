<?php

namespace App\Infrastructure\Tenancy\Console;

use App\Infrastructure\Tenancy\TenantProvisioner;
use Symfony\Component\Console\Attribute\Argument;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:tenant:create',
    description: 'Create a tenant: register it in app_main and build its database app_<name>',
)]
final readonly class TenantCreateCommand
{
    public function __construct(
        private TenantProvisioner $provisioner,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Argument('Tenant name: lowercase letters, digits and "_", starting with a letter')]
        string $name,
        #[Option('Name shown to people (default: the tenant name)')]
        ?string $displayName = null,
    ): int {
        $this->provisioner->create($name, $displayName ?? $name);

        $io->success(\sprintf('Tenant "%s" created.', $name));

        return Command::SUCCESS;
    }
}
