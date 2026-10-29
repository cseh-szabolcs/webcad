<?php

namespace App\Project;

use App\Project\Entity\Project;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler(bus: 'command.bus')]
final readonly class CreateProjectHandler
{
    public function __construct(
        private EntityManagerInterface $entityManager,
    ) {
    }

    public function __invoke(CreateProjectCommand $command): void
    {
        // flush and commit are done by the doctrine_transaction middleware
        $this->entityManager->persist(new Project($command->id, $command->name));
    }
}
