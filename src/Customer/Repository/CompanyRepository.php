<?php

namespace App\Customer\Repository;

use App\Core\Doctrine\WordSearch;
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

    /**
     * All organizations, for App\Core\Doctrine\ListPaginator; private persons are in the customer list.
     *
     * @param string $search    every word must be found in the name or the e-mail
     * @param string $sort      name, updated or created
     * @param string $direction asc or desc
     */
    public function createListQueryBuilder(string $search = '', string $sort = 'name', string $direction = 'asc'): QueryBuilder
    {
        $builder = $this->createQueryBuilder('c')->where('c.organization = true');
        WordSearch::apply($builder, $search, ['c.name', 'c.email']);

        $column = match ($sort) {
            'updated' => 'c.updated',
            'created' => 'c.created',
            default => 'c.name',
        };

        return $builder
            ->orderBy($column, 'desc' === $direction ? 'DESC' : 'ASC')
            ->addOrderBy('c.id');
    }
}
