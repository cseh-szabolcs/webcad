<?php

namespace App\Application\QueryHandler;

use App\Application\DTO\PlanDocumentDTO;
use App\Application\Query\GetPlanDocumentQuery;
use App\Application\Reader\PlanDocumentReader;
use Doctrine\DBAL\Connection;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;
use Symfony\Component\Uid\Uuid;

/**
 * The document of a plan is its draft, the version the editor works on.
 */
#[AsMessageHandler(bus: 'query.bus')]
final readonly class GetPlanDocumentHandler
{
    public function __construct(
        private Connection $connection,
        private PlanDocumentReader $reader,
    ) {
    }

    public function __invoke(GetPlanDocumentQuery $query): ?PlanDocumentDTO
    {
        // UuidType stores UUIDs as BINARY(16) on MySQL
        $draft = $this->connection->fetchAssociative(
            'SELECT v.id, v.revision FROM plan p JOIN plan_version v ON v.id = p.draft_id WHERE p.id = :plan',
            ['plan' => $query->planId->toBinary()],
        );
        if (false === $draft) {
            return null;
        }

        $document = $this->reader->read(Uuid::fromBinary($draft['id']));
        if (null === $document) {
            return null;
        }

        return new PlanDocumentDTO($document, (int) $draft['revision']);
    }
}
