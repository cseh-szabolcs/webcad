<?php

namespace App\Infrastructure\Tenancy;

use App\Domain\Main\Entity\Tenant;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Selects the tenant whose database the tenant connection and entity manager use. The entity
 * manager is cleared first, as an id is only unique inside one database.
 */
final readonly class TenantSwitcher
{
    public function __construct(
        #[Autowire(service: 'doctrine.dbal.tenant_connection')]
        private TenantConnection $tenantConnection,
        #[Autowire(service: 'doctrine.orm.tenant_entity_manager')]
        private EntityManagerInterface $tenantEntityManager,
        private TenantRepository $tenantRepository,
        private TenantNaming $naming,
    ) {
    }

    /**
     * @throws TenantNotFoundException when the registry has no tenant of that name
     */
    public function switchTo(string $name): void
    {
        if (!$this->tenantRepository->findByName($name) instanceof Tenant) {
            throw new TenantNotFoundException($name);
        }

        $database = $this->naming->databaseName($name);
        if ($database === $this->tenantConnection->getTenantDatabase()) {
            return;
        }

        $this->tenantEntityManager->clear();
        $this->tenantConnection->selectDatabase($database);
    }

    /**
     * The selected tenant, or null before one is selected.
     */
    public function current(): ?string
    {
        $database = $this->tenantConnection->getTenantDatabase();

        return null === $database ? null : $this->naming->tenantName($database);
    }
}
