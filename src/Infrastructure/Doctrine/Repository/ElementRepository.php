<?php

namespace App\Infrastructure\Doctrine\Repository;

use App\Domain\Entity\Element;
use App\Domain\Entity\PlanVersion;
use App\Domain\Entity\PolylineElement;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Bridge\Doctrine\Types\UuidType;

/**
 * @extends ServiceEntityRepository<Element>
 */
class ElementRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Element::class);
    }

    /**
     * The elements of a version in document order, polylines with their vertices loaded, so
     * reading them costs no query per polyline.
     *
     * @return list<Element>
     */
    public function findByPlanVersion(PlanVersion $version): array
    {
        // Fetch-joins the vertex lists first; the second query then finds the polylines with them
        // in the identity map
        $this->getEntityManager()->createQueryBuilder()
            ->select('p', 'pv')
            ->from(PolylineElement::class, 'p')
            ->leftJoin('p.vertices', 'pv')
            ->where('p.planVersion = :version')
            // An entity as parameter would not be bound as the binary UUID
            ->setParameter('version', $version->getId(), UuidType::NAME)
            ->getQuery()
            ->getResult();

        return $this->findBy(['planVersion' => $version], ['position' => 'ASC']);
    }
}
