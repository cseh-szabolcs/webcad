<?php

namespace App\Core\Tenancy;

use App\Core\Tenancy\Entity\Tenant;
use App\Core\Tenancy\Exception\TenantNotFoundException;
use App\Core\Tenancy\Repository\TenantRepository;
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
    public function switchTo(string $name): Tenant
    {
        return $this->select($this->tenantRepository->findByName($name) ?? throw new TenantNotFoundException($name));
    }

    /**
     * Selects the tenant of a public id (Tenant::getUuid()), as stored for a logged-in user (TenantStorage).
     *
     * @throws TenantNotFoundException when the registry has no tenant of that uuid
     */
    public function switchToUuid(string $uuid): Tenant
    {
        return $this->select($this->tenantRepository->findByUuid($uuid) ?? throw new TenantNotFoundException($uuid));
    }

    /**
     * The name of the selected tenant, or null before one is selected.
     */
    public function current(): ?string
    {
        $database = $this->tenantConnection->getTenantDatabase();

        return null === $database ? null : $this->naming->tenantName($database);
    }

    /**
     * The selected tenant, or null before one is selected.
     */
    public function currentTenant(): ?Tenant
    {
        $name = $this->current();

        return null === $name ? null : $this->tenantRepository->findByName($name);
    }

    private function select(Tenant $tenant): Tenant
    {
        $database = $this->naming->databaseName($tenant->getName());
        if ($database === $this->tenantConnection->getTenantDatabase()) {
            return $tenant;
        }

        $this->tenantEntityManager->clear();
        $this->tenantConnection->selectDatabase($database);

        return $tenant;
    }
}
