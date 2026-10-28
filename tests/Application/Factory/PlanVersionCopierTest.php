<?php

namespace App\Tests\Application\Factory;

use App\Application\Factory\PlanFactory;
use App\Application\Factory\PlanVersionCopier;
use App\Application\Model\Plan\PlanDocument;
use App\Application\Reader\PlanDocumentReader;
use App\Domain\Entity\Plan;
use App\Domain\Entity\PlanVersion;
use App\Domain\Entity\Project;
use App\Infrastructure\Fixtures\Console\PlanCreateSampleCommand;
use App\Infrastructure\Tenancy\TenantSwitcher;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Uid\Uuid;

final class PlanVersionCopierTest extends KernelTestCase
{
    protected function setUp(): void
    {
        // Without a request or console command, nothing selects the tenant (see .env.test)
        static::getContainer()->get(TenantSwitcher::class)->switchTo($_ENV['DEFAULT_TENANT']);
    }

    public function testCopyIsTheSameDocumentWithFreshIds(): void
    {
        $plan = $this->createSample();
        $draft = $this->read($plan->getDraft());

        $copy = $this->copier()->copy($plan->getDraft());
        $this->em()->flush();

        self::assertSame($plan, $copy->getPlan());
        self::assertNotEquals($plan->getDraft()->getId(), $copy->getId());
        self::assertSame($plan->getDraft()->getUnit(), $copy->getUnit());

        $copied = $this->read($copy);
        self::assertEquals($draft, $this->read($plan->getDraft()), 'The draft is unchanged');

        // Every id is new, and replacing them in order gives the draft again
        $ids = [];
        foreach (['vertices', 'layers', 'groups', 'styles', 'elements'] as $list) {
            self::assertCount(\count($draft[$list]), $copied[$list], $list);
            foreach ($copied[$list] as $i => $item) {
                self::assertNotSame($draft[$list][$i]['id'], $item['id'], $list);
                $ids[$item['id']] = $draft[$list][$i]['id'];
            }
        }
        array_walk_recursive($copied, static function (mixed &$value) use ($ids): void {
            if (\is_string($value) && isset($ids[$value])) {
                $value = $ids[$value];
            }
        });
        self::assertEquals($draft, $copied);
    }

    public function testPublishingCopiesKeepsEarlierHeads(): void
    {
        $plan = $this->createSample();

        $plan->publish($first = $this->copier()->copy($plan->getDraft()), 'Baueingabe');
        $this->em()->flush();
        $plan->publish($second = $this->copier()->copy($plan->getDraft()));
        $this->em()->flush();
        $this->em()->clear();

        $plan = $this->em()->find(Plan::class, $plan->getId());
        self::assertSame(2, $plan->getVersion());
        self::assertEquals($second->getId(), $plan->getHead()->getId());
        self::assertSame(2, $plan->getHead()->getNumber());
        self::assertNull($plan->getDraft()->getNumber());

        // The first head is kept as history, with its contents
        $first = $this->em()->find($first::class, $first->getId());
        self::assertSame(1, $first->getNumber());
        self::assertSame('Baueingabe', $first->getName());
        self::assertNull($plan->getHead()->getName());
        self::assertCount(10, $this->read($first)['elements']);
    }

    private function createSample(): Plan
    {
        $container = static::getContainer();
        $json = file_get_contents($container->getParameter('kernel.project_dir').PlanCreateSampleCommand::SAMPLE_PLAN);
        $document = $container->get(SerializerInterface::class)->deserialize($json, PlanDocument::class, 'json');

        $project = new Project(Uuid::v7(), 'Beispielprojekt');
        $this->em()->persist($project);
        $plan = $container->get(PlanFactory::class)->create($project, $document);
        $this->em()->flush();

        return $plan;
    }

    /**
     * @return array<string, mixed> the version as the API would send it
     */
    private function read(PlanVersion $version): array
    {
        $container = static::getContainer();
        $document = $container->get(PlanDocumentReader::class)->read($version);

        return json_decode($container->get(SerializerInterface::class)->serialize($document, 'json'), true, flags: \JSON_THROW_ON_ERROR);
    }

    private function copier(): PlanVersionCopier
    {
        $container = static::getContainer();

        // Built by hand: no service uses it before the publish action exists, so the container drops it
        return new PlanVersionCopier($container->get(PlanDocumentReader::class), $container->get(PlanFactory::class));
    }

    private function em(): EntityManagerInterface
    {
        return static::getContainer()->get(EntityManagerInterface::class);
    }
}
