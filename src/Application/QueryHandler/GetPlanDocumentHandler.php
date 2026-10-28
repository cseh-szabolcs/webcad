<?php

namespace App\Application\QueryHandler;

use App\Application\DTO\PlanDocumentDTO;
use App\Application\Query\GetPlanDocumentQuery;
use App\Application\Reader\PlanDocumentReader;
use App\Infrastructure\Doctrine\Repository\PlanRepository;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

/**
 * The document of a plan is its draft, the version the editor works on.
 */
#[AsMessageHandler(bus: 'query.bus')]
final readonly class GetPlanDocumentHandler
{
    public function __construct(
        private PlanRepository $plans,
        private PlanDocumentReader $reader,
    ) {
    }

    public function __invoke(GetPlanDocumentQuery $query): ?PlanDocumentDTO
    {
        $draft = $this->plans->find($query->planId)?->getDraft();
        if (null === $draft) {
            return null;
        }

        return new PlanDocumentDTO($this->reader->read($draft), $draft->getRevision());
    }
}
