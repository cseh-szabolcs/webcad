<?php

namespace App\Customer\Repository;

use App\Customer\Entity\Tag;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Tag>
 */
class TagRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Tag::class);
    }

    /** All tags of customers, for App\Core\Doctrine\ListPaginator. */
    public function createListQueryBuilder(): QueryBuilder
    {
        return $this->createQueryBuilder('t')
            ->orderBy('t.name')
            ->addOrderBy('t.id');
    }
}
