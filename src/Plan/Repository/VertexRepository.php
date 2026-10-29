<?php

namespace App\Plan\Repository;

use App\Plan\Entity\PlanVersion;
use App\Plan\Entity\Vertex;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Vertex>
 */
class VertexRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Vertex::class);
    }

    /**
     * The vertices of a version in the order of their ids, which for UUIDv7 is the order they were made.
     *
     * @return list<Vertex>
     */
    public function findByPlanVersion(PlanVersion $version): array
    {
        return $this->findBy(['planVersion' => $version], ['id' => 'ASC']);
    }
}
