<?php

namespace App\Tests\Fixtures;

use App\Core\Tenancy\TenantProvisioner;
use App\Core\Tenancy\TenantSwitcher;
use App\Fixtures\FixtureCreateCommand;
use App\Plan\Entity\Element;
use App\Plan\Entity\Plan;
use App\Project\Entity\Project;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Uid\Uuid;

/**
 * Runs on a tenant of its own (app_phpunit_…_test), as the command empties the whole database.
 */
final class FixtureCreateCommandTest extends KernelTestCase
{
    private string $tenant;

    protected function setUp(): void
    {
        $this->tenant = 'phpunit_'.bin2hex(random_bytes(4));
        static::getContainer()->get(TenantProvisioner::class)->create($this->tenant, 'Phpunit');
        // The command tester fires no console events, so the tenant listener does not run
        static::getContainer()->get(TenantSwitcher::class)->switchTo($this->tenant);
    }

    protected function tearDown(): void
    {
        static::getContainer()->get(TenantProvisioner::class)->delete($this->tenant);

        parent::tearDown();
    }

    public function testResetsTheDatabaseAndCreatesTheSamplePlan(): void
    {
        $this->em()->persist(new Project(Uuid::v7(), 'Einfamilienhaus'));
        $this->em()->flush();

        self::assertSame(Command::SUCCESS, $this->tester()->execute(['--force' => true]));

        $this->em()->clear();
        $projects = $this->em()->getRepository(Project::class)->findAll();
        self::assertCount(1, $projects);
        self::assertSame('Beispielprojekt', $projects[0]->getName());

        $plans = $this->em()->getRepository(Plan::class)->findAll();
        self::assertCount(1, $plans);
        self::assertSame(FixtureCreateCommand::DEV_PLAN_ID, $plans[0]->getId()->toRfc4122());
        self::assertSame('Sample room', $plans[0]->getName());
        self::assertCount(10, $this->em()->getRepository(Element::class)->findBy(['planVersion' => $plans[0]->getDraft()]));
    }

    public function testCanBeRunAgain(): void
    {
        self::assertSame(Command::SUCCESS, $this->tester()->execute(['--force' => true]));
        self::assertSame(Command::SUCCESS, $this->tester()->execute(['--force' => true, '--project-name' => 'Einfamilienhaus']));

        $this->em()->clear();
        self::assertCount(1, $this->em()->getRepository(Plan::class)->findAll());
        self::assertSame(['Einfamilienhaus'], array_map(static fn (Project $p) => $p->getName(), $this->em()->getRepository(Project::class)->findAll()));
    }

    public function testPlanGetsTheGivenId(): void
    {
        $id = Uuid::v7()->toRfc4122();

        $tester = $this->tester();
        self::assertSame(Command::SUCCESS, $tester->execute(['--force' => true, '--plan-id' => $id]));
        self::assertStringContainsString(\sprintf('Plan "Sample room" (%s)', $id), $tester->getDisplay());

        self::assertSame(Command::FAILURE, $tester->execute(['--force' => true, '--plan-id' => 'sample']));
    }

    public function testDeclinedConfirmationChangesNothing(): void
    {
        $this->em()->persist(new Project(Uuid::v7(), 'Einfamilienhaus'));
        $this->em()->flush();

        $tester = $this->tester();
        $tester->setInputs(['no']);
        self::assertSame(Command::SUCCESS, $tester->execute([]));
        self::assertStringContainsString('Aborted', $tester->getDisplay());

        $this->em()->clear();
        self::assertCount(1, $this->em()->getRepository(Project::class)->findAll());
        self::assertSame([], $this->em()->getRepository(Plan::class)->findAll());
    }

    private function tester(): CommandTester
    {
        return new CommandTester((new Application(self::$kernel))->find('app:fixture:create'));
    }

    private function em(): EntityManagerInterface
    {
        return static::getContainer()->get(EntityManagerInterface::class);
    }
}
