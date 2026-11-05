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

    /** All companies, for App\Core\Doctrine\ListPaginator. */
    public function createListQueryBuilder(): QueryBuilder
    {
        return $this->createQueryBuilder('c')
            ->orderBy('c.name')
            ->addOrderBy('c.id');
    }
}
