<?php

namespace App\Fixtures;

use App\Core\Tenancy\TenantNotSelectedException;
use App\Core\Tenancy\TenantProvisioner;
use App\Core\Tenancy\TenantSwitcher;
use App\Plan\Api\Model\PlanDocument;
use App\Plan\PlanFactory;
use App\Project\Entity\Project;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\DependencyInjection\Attribute\When;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Uid\Uuid;

/**
 * Development data: resets the tenant's database (every table dropped, schema rebuilt from the
 * migrations) and creates one project with the sample plan the editor is tested with (the backend
 * copy of depts/editor/src/cad/__fixtures__/sample-plan.json). The plan gets the id the editor
 * loads in dev when the URL names no plan (DEV_PLAN_ID in App.tsx), unless --plan-id names
 * another. Registered in dev only (and in test, for its test), never in prod.
 */
#[When(env: 'dev')]
#[When(env: 'test')]
#[AsCommand(
    name: 'app:fixture:create',
    description: 'Reset the tenant database and create the sample plan in a new project',
)]
final readonly class FixtureCreateCommand
{
    public const string SAMPLE_PLAN = '/fixtures/plans/sample-plan.json';
    public const string DEV_PLAN_ID = '01994f4e-6f3a-7c2d-9b1e-5a3c2d1e0f42';

    public function __construct(
        private TenantSwitcher $tenantSwitcher,
        private TenantProvisioner $provisioner,
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
        #[Option('Name of the project')]
        string $projectName = 'Beispielprojekt',
        #[Option('Id for the plan')]
        string $planId = self::DEV_PLAN_ID,
        #[Option('Skip the confirmation (required without interaction)', shortcut: 'f')]
        bool $force = false,
    ): int {
        if (!Uuid::isValid($planId)) {
            $io->error(\sprintf('"%s" is not a UUID.', $planId));

            return Command::FAILURE;
        }

        $tenant = $this->tenantSwitcher->current() ?? throw new TenantNotSelectedException();

        $io->warning(\sprintf('This deletes all data of tenant "%s".', $tenant));
        if (!$force && !$io->confirm('Reset the database?', false)) {
            $io->note('Aborted, nothing was changed.');

            return Command::SUCCESS;
        }

        $this->provisioner->reset($tenant);
        // Nothing loaded before the reset exists any more
        $this->entityManager->clear();

        $project = new Project(Uuid::v7(), $projectName);
        $document = $this->serializer->deserialize(file_get_contents($this->projectDir.self::SAMPLE_PLAN), PlanDocument::class, 'json');
        $plan = $this->entityManager->wrapInTransaction(function () use ($project, $document, $planId) {
            $this->entityManager->persist($project);

            return $this->planFactory->create($project, $document, Uuid::fromString($planId));
        });

        $io->success(\sprintf('Plan "%s" (%s) created in project "%s" (%s).', $plan->getName(), $plan->getId()->toRfc4122(), $project->getName(), $project->getId()->toRfc4122()));
        if (null !== $this->editorUrl && '' !== $this->editorUrl) {
            $io->writeln(\sprintf('Open it in the editor: %s/?plan=%s', rtrim($this->editorUrl, '/'), $plan->getId()->toRfc4122()));
        }

        return Command::SUCCESS;
    }
}
