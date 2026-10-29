<?php

namespace App\Core\Tenancy;

use App\Core\Tenancy\Console\Application;
use Doctrine\DBAL\Exception as DBALException;
use Symfony\Component\Console\ConsoleEvents;
use Symfony\Component\Console\Event\ConsoleCommandEvent;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;

/**
 * Selects the tenant of a console command: --tenant=<name>, else DEFAULT_TENANT (set in dev and
 * test only), else none.
 */
#[AsEventListener(event: ConsoleEvents::COMMAND)]
final readonly class TenantConsoleListener
{
    public function __construct(
        private TenantSwitcher $tenantSwitcher,
        #[Autowire(env: 'default::DEFAULT_TENANT')]
        private ?string $defaultTenant,
    ) {
    }

    /**
     * @throws TenantNotFoundException when --tenant names an unknown tenant
     */
    public function __invoke(ConsoleCommandEvent $event): void
    {
        $tenant = $event->getInput()->getParameterOption('--'.Application::TENANT_OPTION, null, true);
        if (\is_string($tenant) && '' !== $tenant) {
            $this->tenantSwitcher->switchTo($tenant);

            return;
        }

        if (null === $this->defaultTenant || '' === $this->defaultTenant) {
            return;
        }

        // Best effort, it must never break the command: on a fresh installation app_main or the
        // default tenant do not exist yet (app:tenant:create is what makes them).
        try {
            $this->tenantSwitcher->switchTo($this->defaultTenant);
        } catch (TenantNotFoundException|DBALException) {
        }
    }
}
