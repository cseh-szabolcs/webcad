<?php

namespace App\Customer\Repository;

use App\Customer\Entity\Company;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Company>
 */
class CompanyRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Company::class);
    }

    /** All organizations, for App\Core\Doctrine\ListPaginator; private persons are in the customer list. */
    public function createListQueryBuilder(): QueryBuilder
    {
        return $this->createQueryBuilder('c')
            ->where('c.organization = true')
            ->orderBy('c.name')
            ->addOrderBy('c.id');
    }
}
