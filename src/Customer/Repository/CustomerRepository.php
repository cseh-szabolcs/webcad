<?php

namespace App\Customer\Repository;

use App\Customer\Entity\Customer;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

/**
 * @extends ServiceEntityRepository<Customer>
 */
class CustomerRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Customer::class);
    }

    /**
     * The customers with their company and tags, for App\Core\Doctrine\ListPaginator.
     *
     * @param string    $search    every word must be found in a name, the company or the e-mail
     * @param Uuid|null $tag       only customers with this tag; they keep all their other tags
     * @param string    $sort      name (a customer without a last name by its company), updated or created
     * @param string    $direction asc or desc
     */
    public function createListQueryBuilder(
        string $search = '',
        ?Uuid $tag = null,
        string $sort = 'name',
        string $direction = 'asc',
    ): QueryBuilder {
        $builder = $this->createDetailQueryBuilder();

        foreach (preg_split('/\s+/', $search, flags: \PREG_SPLIT_NO_EMPTY) as $index => $word) {
            $parameter = 'word'.$index;
            $builder
                ->andWhere(\sprintf(
                    'c.firstname LIKE :%1$s OR c.lastname LIKE :%1$s OR co.email LIKE :%1$s OR co.name LIKE :%1$s',
                    $parameter,
                ))
                ->setParameter($parameter, '%'.addcslashes($word, '%_\\').'%');
        }

        // Not a condition on the join `t`, which would leave only this tag in the customer's tags.
        if (null !== $tag) {
            $builder
                ->andWhere(\sprintf(
                    'EXISTS (SELECT 1 FROM %s tagged JOIN tagged.tags tag WHERE tagged = c AND tag.uuid = :tag)',
                    Customer::class,
                ))
                ->setParameter('tag', $tag, UuidType::NAME);
        }

        $direction = 'desc' === $direction ? 'DESC' : 'ASC';
        match ($sort) {
            'updated' => $builder->orderBy('c.updated', $direction),
            'created' => $builder->orderBy('c.created', $direction),
            default => $builder
                ->addSelect('COALESCE(c.lastname, co.name) AS HIDDEN sortName')
                ->orderBy('sortName', $direction)
                ->addOrderBy('c.firstname', $direction),
        };

        return $builder->addOrderBy('c.id');
    }

    /** The customer with its company and tags, in one query. */
    public function findOneForDetail(Uuid $id): ?Customer
    {
        return $this->createDetailQueryBuilder()
            ->andWhere('c.uuid = :id')
            ->setParameter('id', $id, UuidType::NAME)
            ->getQuery()
            ->getOneOrNullResult();
    }

    private function createDetailQueryBuilder(): QueryBuilder
    {
        return $this->createQueryBuilder('c')
            ->addSelect('co', 't')
            ->join('c.company', 'co')
            ->leftJoin('c.tags', 't');
    }
}
