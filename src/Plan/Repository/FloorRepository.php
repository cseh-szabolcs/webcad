<?php

namespace App\Plan\Repository;

use App\Plan\Entity\Floor;
use App\Plan\Entity\PlanVersion;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Floor>
 */
class FloorRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Floor::class);
    }

    /**
     * The floors of a version in their order.
     *
     * @return list<Floor>
     */
    public function findByPlanVersion(PlanVersion $version): array
    {
        return $this->findBy(['planVersion' => $version], ['position' => 'ASC']);
    }
}
