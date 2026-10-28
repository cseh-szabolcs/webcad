<?php

namespace App\Infrastructure\Doctrine\Repository;

use App\Domain\Entity\Group;
use App\Domain\Entity\PlanVersion;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Group>
 */
class GroupRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Group::class);
    }

    /**
     * The groups of a version in the order of their ids, which for UUIDv7 is the order they were made.
     *
     * @return list<Group>
     */
    public function findByPlanVersion(PlanVersion $version): array
    {
        return $this->findBy(['planVersion' => $version], ['id' => 'ASC']);
    }
}
