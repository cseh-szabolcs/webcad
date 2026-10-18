<?php

namespace App\Application\QueryHandler;

use App\Application\DTO\ProjectDTO;
use App\Application\Query\GetProjectQuery;
use Doctrine\DBAL\Connection;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler(bus: 'query.bus')]
final readonly class GetProjectHandler
{
    public function __construct(
        private Connection $connection,
    ) {
    }

    public function __invoke(GetProjectQuery $query): ?ProjectDTO
    {
        // UuidType stores UUIDs as BINARY(16) on MySQL
        $name = $this->connection->fetchOne(
            'SELECT name FROM project WHERE id = :id',
            ['id' => $query->id->toBinary()],
        );

        if (false === $name) {
            return null;
        }

        return new ProjectDTO(id: $query->id->toRfc4122(), name: $name);
    }
}
