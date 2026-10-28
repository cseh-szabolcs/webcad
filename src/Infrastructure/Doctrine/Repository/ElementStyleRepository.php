<?php

namespace App\Infrastructure\Doctrine\Repository;

use App\Domain\Entity\ElementStyle;
use App\Domain\Entity\PlanVersion;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<ElementStyle>
 */
class ElementStyleRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ElementStyle::class);
    }

    /**
     * The styles of a version in the order of their ids, which for UUIDv7 is the order they were made.
     *
     * @return list<ElementStyle>
     */
    public function findByPlanVersion(PlanVersion $version): array
    {
        return $this->findBy(['planVersion' => $version], ['id' => 'ASC']);
    }
}
