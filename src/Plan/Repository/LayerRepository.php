<?php

namespace App\Plan\Repository;

use App\Plan\Entity\Layer;
use App\Plan\Entity\PlanVersion;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Layer>
 */
class LayerRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Layer::class);
    }

    /**
     * The layers of a version in drawing order.
     *
     * @return list<Layer>
     */
    public function findByPlanVersion(PlanVersion $version): array
    {
        return $this->findBy(['planVersion' => $version], ['position' => 'ASC']);
    }
}
