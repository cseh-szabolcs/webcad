<?php

namespace App\Security\Repository;

use App\Core\Traits\RepositoryTrait;
use App\Security\Entity\Token;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\NoResultException;
use Doctrine\Persistence\ManagerRegistry;
use InvalidArgumentException;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

/**
 * @extends ServiceEntityRepository<Token>
 */
class TokenRepository extends ServiceEntityRepository
{
    use RepositoryTrait;

    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Token::class);
    }

    public function findToken(Uuid|string|null $token): ?Token
    {
        try {
            $uuid = Uuid::fromString($token ?? '');

            $result = $this->createQueryBuilder('t')
                ->select('t, u')
                ->join('t.owner', 'u')
                ->andWhere('t.id = :id')
                ->setParameter('id', $uuid, UuidType::NAME)
                ->getQuery()
                ->getOneOrNullResult();

            $this->assertResult($result);

            return $result;

        } catch (InvalidArgumentException) {
            throw new NoResultException();
        }
    }

    public function findOneByOwnerAndType(string|int|User $user, string $type): ?Token
    {
        if ($user instanceof User) {
            $user = $user->getId();
        }

        return $this->createQueryBuilder('t')
            ->select('t, u')
            ->join('t.owner', 'u')
            ->andWhere('t.owner = :user')
            ->andWhere('t.type = :type')
            ->setParameter('user', (int) $user)
            ->setParameter('type', $type)
            ->getQuery()
            ->setMaxResults(1)
            ->getOneOrNullResult();
    }

    public function countUserToken(User $user, string $type): int
    {
        return (int) $this->createQueryBuilder('t')
            ->select('COUNT(t.id)')
            ->andWhere('t.owner = :user')
            ->andWhere('t.type = :type')
            ->setParameter('user', $user)
            ->setParameter('type', $type)
            ->getQuery()
            ->getSingleScalarResult();
    }
}
