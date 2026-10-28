<?php

namespace App\Tests\Infrastructure\Fixtures;

use App\Domain\Entity\Element;
use App\Domain\Entity\Plan;
use App\Infrastructure\Tenancy\TenantSwitcher;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Uid\Uuid;

final class PlanCreateSampleCommandTest extends KernelTestCase
{
    protected function setUp(): void
    {
        // The command tester fires no console events, so the tenant listener does not run
        static::getContainer()->get(TenantSwitcher::class)->switchTo($_ENV['DEFAULT_TENANT']);
    }

    public function testCreatesANewPlanEachTime(): void
    {
        $first = $this->createSample([]);
        $second = $this->createSample([]);

        self::assertNotEquals($first->getId(), $second->getId());
        self::assertNotEquals($first->getProject()->getId(), $second->getProject()->getId());
        self::assertSame('Beispielprojekt', $second->getProject()->getName());
        self::assertCount(10, $this->em()->getRepository(Element::class)->findBy(['planVersion' => $second->getDraft()]));
    }

    public function testAddsThePlanToAnExistingProject(): void
    {
        $project = $this->createSample(['--project-name' => 'Einfamilienhaus'])->getProject();

        $plan = $this->createSample(['--project' => $project->getId()->toRfc4122()]);

        self::assertEquals($project->getId(), $plan->getProject()->getId());
        self::assertSame('Einfamilienhaus', $plan->getProject()->getName());
    }

    public function testPlanGetsTheGivenIdOnce(): void
    {
        $id = Uuid::v7()->toRfc4122();

        self::assertSame($id, $this->createSample(['--plan-id' => $id])->getId()->toRfc4122());

        $tester = $this->tester();
        self::assertSame(Command::FAILURE, $tester->execute(['--plan-id' => $id]));
        self::assertStringContainsString('already exists', $tester->getDisplay());
        self::assertSame(Command::FAILURE, $tester->execute(['--plan-id' => 'sample']));
    }

    public function testUnknownProjectFails(): void
    {
        $tester = $this->tester();

        self::assertSame(Command::FAILURE, $tester->execute(['--project' => Uuid::v7()->toRfc4122()]));
        self::assertStringContainsString('not found', $tester->getDisplay());
    }

    /**
     * @param array<string, string> $input
     */
    private function createSample(array $input): Plan
    {
        $tester = $this->tester();
        self::assertSame(Command::SUCCESS, $tester->execute($input));
        self::assertSame(1, preg_match('/Plan "Sample room" \(([0-9a-f-]{36})\)/', $tester->getDisplay(), $match));

        $this->em()->clear();

        return $this->em()->find(Plan::class, Uuid::fromString($match[1]));
    }

    private function tester(): CommandTester
    {
        return new CommandTester((new Application(self::$kernel))->find('app:plan:create-sample'));
    }

    private function em(): EntityManagerInterface
    {
        return static::getContainer()->get(EntityManagerInterface::class);
    }
}
