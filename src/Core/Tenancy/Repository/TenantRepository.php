<?php

namespace App\Core\Tenancy\Repository;

use App\Core\Tenancy\Entity\Tenant;
use App\Core\Traits\RepositoryTrait;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/**
 * @extends ServiceEntityRepository<Tenant>
 */
class TenantRepository extends ServiceEntityRepository
{
    use RepositoryTrait;

    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Tenant::class);
    }

    /**
     * The tenant of a name's slug (see Tenant::SLUG_SEPARATOR).
     */
    public function findBySlug(string $slug): ?Tenant
    {
        return $this->findOneBy(['slug' => $slug]);
    }

    /**
     * The tenant of an internal id (Tenant::getHash()).
     */
    public function findByHash(string $hash): ?Tenant
    {
        return $this->findOneBy(['hash' => $hash]);
    }

    /**
     * The tenant of a public id (Tenant::getUuid()), or null also for a string that is no uuid.
     */
    public function findByUuid(string $uuid): ?Tenant
    {
        return Uuid::isValid($uuid) ? $this->findOneBy(['uuid' => Uuid::fromString($uuid)]) : null;
    }

    /**
     * @return list<Tenant>
     */
    public function findAllOrdered(): array
    {
        return $this->findBy([], ['name' => 'ASC']);
    }
}
