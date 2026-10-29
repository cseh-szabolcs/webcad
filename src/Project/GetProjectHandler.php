<?php

namespace App\Project;

use App\Project\Repository\ProjectRepository;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler(bus: 'query.bus')]
final readonly class GetProjectHandler
{
    public function __construct(
        private ProjectRepository $projects,
    ) {
    }

    public function __invoke(GetProjectQuery $query): ?ProjectDTO
    {
        $project = $this->projects->find($query->id);
        if (null === $project) {
            return null;
        }

        return new ProjectDTO(id: $project->getId()->toRfc4122(), name: $project->getName());
    }
}
