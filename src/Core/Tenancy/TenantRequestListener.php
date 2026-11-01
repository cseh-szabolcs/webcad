<?php

namespace App\Core\Tenancy;

use App\Core\Tenancy\Exception\TenantNotFoundException;
use Doctrine\DBAL\Exception as DBALException;
use Psr\Log\LoggerInterface;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Selects the tenant of a request: the one the user logged in to (TenantStorage), else none, so a
 * guest's request never reaches a tenant database. Logging in selects the tenant itself
 * (UserAuthenticator). Runs after the session listener (128) and before the firewall (8), so the
 * user is refreshed, or logged in by remember-me, from the database of its tenant.
 */
#[AsEventListener(event: KernelEvents::REQUEST, priority: 64)]
final readonly class TenantRequestListener
{
    public function __construct(
        private TenantSwitcher $tenantSwitcher,
        private TenantStorage $tenantStorage,
        private LoggerInterface $logger,
    ) {
    }

    public function __invoke(RequestEvent $event): void
    {
        $request = $event->getRequest();
        if (!$event->isMainRequest() || null === $tenant = $this->tenantStorage->fromRequest($request)) {
            return;
        }

        try {
            $this->tenantSwitcher->switchToUuid($tenant);
        } catch (TenantNotFoundException|DBALException $e) {
            // A tenant deleted since the login, or a cookie that holds no tenant's uuid: the user is
            // a guest now (UserProvider finds no user without a tenant).
            $this->tenantStorage->clear($request);
            $this->logger->warning('Stored tenant "{tenant}" not selected: {message}', [
                'tenant' => $tenant,
                'message' => $e->getMessage(),
            ]);
        }
    }
}
