<?php

namespace App\Application\QueryHandler;

use App\Application\DTO\PlanDocumentDTO;
use App\Application\Query\GetPlanDocumentQuery;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

/**
 * Temporary: serves plan documents from JSON fixtures until PlanVersion exists.
 */
#[AsMessageHandler(bus: 'query.bus')]
final readonly class GetPlanDocumentHandler
{
    public function __construct(
        #[Autowire('%kernel.project_dir%/fixtures/plans')]
        private string $fixtureDir,
    ) {
    }

    public function __invoke(GetPlanDocumentQuery $query): ?PlanDocumentDTO
    {
        $planId = $query->planId->toRfc4122();
        $file = \sprintf('%s/%s.json', $this->fixtureDir, $planId);

        if (!is_file($file)) {
            return null;
        }

        $json = file_get_contents($file);
        if (false === $json || !json_validate($json)) {
            throw new \RuntimeException(\sprintf('Plan fixture "%s" is not valid JSON.', $file));
        }

        return new PlanDocumentDTO(planId: $planId, revision: 1, documentJson: $json);
    }
}
