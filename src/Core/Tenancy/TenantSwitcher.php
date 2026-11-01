<?php

namespace App\Core\Tenancy;

use App\Core\Tenancy\Entity\Tenant;
use App\Core\Tenancy\Exception\TenantNotFoundException;
use App\Core\Tenancy\Repository\TenantRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Selects the tenant whose database the tenant connection and entity manager use. The entity
 * manager is cleared first, as an id is only unique inside one database. It checks no parameter and
 * makes no slug: it expects them correct (validating names belongs to the registration, slugging the
 * typed name to the login), and only says when no tenant has the value.
 */
final readonly class TenantSwitcher
{
    public function __construct(
        #[Autowire(service: 'doctrine.dbal.tenant_connection')]
        private TenantConnection $tenantConnection,
        #[Autowire(service: 'doctrine.orm.tenant_entity_manager')]
        private EntityManagerInterface $tenantEntityManager,
        private TenantRepository $tenantRepository,
        private TenantProvisioner $provisioner,
    ) {
    }

    /**
     * Selects the tenant of an internal id (Tenant::getHash()), e.g. of console --tenant.
     *
     * @throws TenantNotFoundException when the registry has no tenant of that hash
     */
    public function switchTo(string $hash): Tenant
    {
        return $this->select($this->tenantRepository->findByHash($hash) ?? throw new TenantNotFoundException($hash));
    }

    /**
     * Selects the tenant of a slug, e.g. of the name typed at login (see Tenant::SLUG_SEPARATOR).
     *
     * @throws TenantNotFoundException when the registry has no tenant of that slug
     */
    public function switchToSlug(string $slug): Tenant
    {
        return $this->select($this->tenantRepository->findBySlug($slug) ?? throw new TenantNotFoundException($slug));
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
     * The hash of the selected tenant, or null before one is selected.
     */
    public function current(): ?string
    {
        $database = $this->tenantConnection->getTenantDatabase();

        return null === $database ? null : $this->provisioner->tenantHash($database);
    }

    /**
     * The selected tenant, or null before one is selected.
     */
    public function currentTenant(): ?Tenant
    {
        $hash = $this->current();

        return null === $hash ? null : $this->tenantRepository->findByHash($hash);
    }

    private function select(Tenant $tenant): Tenant
    {
        $database = $this->provisioner->databaseName($tenant->getHash());
        if ($database === $this->tenantConnection->getTenantDatabase()) {
            return $tenant;
        }

        $this->tenantEntityManager->clear();
        $this->tenantConnection->selectDatabase($database);

        return $tenant;
    }
}
