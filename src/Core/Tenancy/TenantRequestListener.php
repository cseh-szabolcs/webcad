<?php

namespace App\Core\Tenancy;

use Doctrine\DBAL\Exception as DBALException;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Selects the tenant of a request. There are no users yet, so this is DEFAULT_TENANT (set in dev and
 * test only); once users log in, their tenant takes its place. Without a tenant, the tenant
 * connection refuses every query.
 */
#[AsEventListener(event: KernelEvents::REQUEST, priority: 64)]
final readonly class TenantRequestListener
{
    public function __construct(
        private TenantSwitcher $tenantSwitcher,
        private LoggerInterface $logger,
        #[Autowire(env: 'default::DEFAULT_TENANT')]
        private ?string $defaultTenant,
    ) {
    }

    public function __invoke(RequestEvent $event): void
    {
        if (!$event->isMainRequest() || null === $this->defaultTenant || '' === $this->defaultTenant) {
            return;
        }

        // Requests that need no database must keep working while the default tenant is missing.
        try {
            $this->tenantSwitcher->switchTo($this->defaultTenant);
        } catch (TenantNotFoundException|DBALException $e) {
            $this->logger->warning('Default tenant "{tenant}" not selected: {message}', [
                'tenant' => $this->defaultTenant,
                'message' => $e->getMessage(),
            ]);
        }
    }
}
