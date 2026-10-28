<?php

namespace App\Infrastructure\Fixtures\Console;

use App\Application\Factory\PlanFactory;
use App\Application\Model\Plan\PlanDocument;
use App\Domain\Entity\Plan;
use App\Domain\Entity\Project;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Uid\Uuid;

/**
 * Development data: the sample plan the editor is tested with (the backend copy of
 * depts/editor/src/cad/__fixtures__/sample-plan.json), created as a new plan with fresh ids
 * each time, so it can be run again and again. --plan-id gives the plan a fixed id instead, e.g.
 * the one the editor loads in dev when the URL names no plan.
 */
#[AsCommand(
    name: 'app:plan:create-sample',
    description: 'Create the sample plan with all its entities in a new project, or in an existing one',
)]
final readonly class PlanCreateSampleCommand
{
    public const string SAMPLE_PLAN = '/fixtures/plans/sample-plan.json';

    public function __construct(
        private PlanFactory $planFactory,
        private EntityManagerInterface $entityManager,
        private SerializerInterface $serializer,
        #[Autowire('%kernel.project_dir%')]
        private string $projectDir,
        #[Autowire(env: 'default::EDITOR_URL')]
        private ?string $editorUrl,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Option('Id of the project to add the plan to (default: a new project)')]
        ?string $project = null,
        #[Option('Name of the new project')]
        string $projectName = 'Beispielprojekt',
        #[Option('Id for the plan (default: a new one)')]
        ?string $planId = null,
    ): int {
        if (null !== $planId) {
            if (!Uuid::isValid($planId)) {
                $io->error(\sprintf('"%s" is not a UUID.', $planId));

                return Command::FAILURE;
            }
            if (null !== $this->entityManager->find(Plan::class, Uuid::fromString($planId))) {
                $io->error(\sprintf('Plan "%s" already exists.', $planId));

                return Command::FAILURE;
            }
        }

        if (null === $project) {
            $target = new Project(Uuid::v7(), $projectName);
            $this->entityManager->persist($target);
        } else {
            $target = Uuid::isValid($project) ? $this->entityManager->find(Project::class, Uuid::fromString($project)) : null;
            if (null === $target) {
                $io->error(\sprintf('Project "%s" not found.', $project));

                return Command::FAILURE;
            }
        }

        $document = $this->serializer->deserialize(file_get_contents($this->projectDir.self::SAMPLE_PLAN), PlanDocument::class, 'json');
        $plan = $this->entityManager->wrapInTransaction(fn () => $this->planFactory->create($target, $document, null === $planId ? null : Uuid::fromString($planId)));

        $io->success(\sprintf('Plan "%s" (%s) created in project "%s" (%s).', $plan->getName(), $plan->getId()->toRfc4122(), $target->getName(), $target->getId()->toRfc4122()));
        if (null !== $this->editorUrl && '' !== $this->editorUrl) {
            $io->writeln(\sprintf('Open it in the editor: %s/?plan=%s', rtrim($this->editorUrl, '/'), $plan->getId()->toRfc4122()));
        }

        return Command::SUCCESS;
    }
}
