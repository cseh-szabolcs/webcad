<?php

namespace App\Tests\Application\Factory;

use App\Application\Factory\PlanFactory;
use App\Application\Model\Plan\LineElement;
use App\Application\Model\Plan\PlanDocument;
use App\Domain\Entity;
use App\Domain\Entity\Element;
use App\Domain\Entity\Plan;
use App\Domain\Entity\Project;
use App\Domain\Enum\PlanUnit;
use App\Infrastructure\Fixtures\Console\PlanCreateSampleCommand;
use App\Infrastructure\Tenancy\TenantSwitcher;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Uid\Uuid;

final class PlanFactoryTest extends KernelTestCase
{
    protected function setUp(): void
    {
        // Without a request or console command, nothing selects the tenant (see .env.test)
        static::getContainer()->get(TenantSwitcher::class)->switchTo($_ENV['DEFAULT_TENANT']);
    }

    public function testSamplePlanIsCreatedWithFreshIds(): void
    {
        $document = $this->sampleDocument();
        $plan = $this->createAndReload($document);

        self::assertSame('Sample room', $plan->getName());
        self::assertSame(PlanUnit::Millimetre, $plan->getDraft()->getUnit());
        self::assertNotSame($document->id, $plan->getId()->toRfc4122());

        $elements = $this->elementsOf($plan);
        self::assertSame(
            ['Wall outer', 'Wall inner', 'Door leaf', 'Door swing', 'Window', 'Table', 'Sofa', 'Axis', 'Rug', 'Curtain'],
            array_map(static fn (Element $e): ?string => $e->getName(), $elements),
        );
        self::assertCount(20, $this->entitiesOf(Entity\Vertex::class, $plan));
        self::assertCount(1, $this->entitiesOf(Entity\Group::class, $plan));
        self::assertCount(4, $this->entitiesOf(Entity\ElementStyle::class, $plan));

        $layers = $this->entitiesOf(Entity\Layer::class, $plan, ['position' => 'ASC']);
        self::assertSame(['Walls', 'Doors & windows', 'Furniture'], array_map(static fn (Entity\Layer $l): string => $l->getName(), $layers));

        $documentIds = [];
        foreach ([...$document->vertices, ...$document->layers, ...$document->groups, ...$document->styles] as $model) {
            $documentIds[] = $model->id;
        }
        foreach ($elements as $element) {
            self::assertNotContains($element->getId()->toRfc4122(), $documentIds);
        }
    }

    public function testReferencesPointToTheNewEntities(): void
    {
        [$wallOuter, , $doorLeaf, $doorSwing, , $table, , $axis, $rug, $curtain] = $this->elementsOf($this->createAndReload($this->sampleDocument()));

        // Shared vertices stay shared
        self::assertSame($wallOuter->getVertices()[0], $axis->getStartVertex());
        self::assertSame($table->getCenterVertex(), $rug->getCenterVertex());
        self::assertSame($doorSwing->getEndVertex(), $doorLeaf->getEndVertex());

        self::assertSame('Walls', $wallOuter->getLayer()->getName());
        self::assertSame('Wall', $wallOuter->getStyle()->getName());
        self::assertTrue($wallOuter->isClosed());
        self::assertSame('Door D1', $doorLeaf->getGroup()->getName());
        self::assertNull($axis->getLayer());
        self::assertNull($axis->getStyle());
        self::assertSame(600.0, $table->getRadius());
        self::assertSame([1000.0, 700.0, 0.0], [$rug->getRadiusX(), $rug->getRadiusY(), $rug->getRotation()]);
        self::assertSame([500.0, -200.0], [$curtain->getStartControlX(), $curtain->getStartControlY()]);
    }

    public function testFurtherVersionIsAddedToThePlan(): void
    {
        $plan = $this->createAndReload($this->sampleDocument());

        $document = $this->sampleDocument();
        $document = new PlanDocument($document->id, 'Other name', $document->schemaVersion, PlanUnit::Metre, $document->vertices, $document->elements, $document->layers, $document->groups, $document->styles);
        $version = $this->factory()->createVersion($plan, $document);
        $this->em()->flush();

        self::assertSame($plan, $version->getPlan());
        self::assertNotSame($plan->getDraft(), $version);
        self::assertSame(PlanUnit::Metre, $version->getUnit());
        self::assertNull($version->getNumber());
        self::assertSame('Sample room', $plan->getName());
        self::assertCount(10, $this->em()->getRepository(Element::class)->findBy(['planVersion' => $version]));
        self::assertCount(10, $this->elementsOf($plan));
    }

    public function testUnknownReferenceIsRejected(): void
    {
        $document = $this->sampleDocument();
        $elements = $document->elements;
        $elements[] = new LineElement(Uuid::v7()->toRfc4122(), null, null, null, $document->vertices[0]->id, Uuid::v7()->toRfc4122());

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessageMatches('/unknown vertex/');

        $this->factory()->create(new Project(Uuid::v7(), 'P'), $this->withElements($document, $elements));
    }

    public function testOtherSchemaVersionIsRejected(): void
    {
        $document = $this->sampleDocument();
        $document = new PlanDocument($document->id, $document->name, 2, $document->unit, $document->vertices, $document->elements, $document->layers, $document->groups, $document->styles);

        $this->expectException(\InvalidArgumentException::class);

        $this->factory()->create(new Project(Uuid::v7(), 'P'), $document);
    }

    private function sampleDocument(): PlanDocument
    {
        $json = file_get_contents(static::getContainer()->getParameter('kernel.project_dir').PlanCreateSampleCommand::SAMPLE_PLAN);

        return static::getContainer()->get(SerializerInterface::class)->deserialize($json, PlanDocument::class, 'json');
    }

    /**
     * @param list<\App\Application\Model\Plan\ElementInterface> $elements
     */
    private function withElements(PlanDocument $d, array $elements): PlanDocument
    {
        return new PlanDocument($d->id, $d->name, $d->schemaVersion, $d->unit, $d->vertices, $elements, $d->layers, $d->groups, $d->styles);
    }

    private function createAndReload(PlanDocument $document): Plan
    {
        $project = new Project(Uuid::v7(), 'Beispielprojekt');
        $this->em()->persist($project);
        $plan = $this->factory()->create($project, $document);
        $this->em()->flush();
        $this->em()->clear();

        return $this->em()->find(Plan::class, $plan->getId());
    }

    /**
     * @return list<Element>
     */
    private function elementsOf(Plan $plan): array
    {
        return $this->entitiesOf(Element::class, $plan, ['position' => 'ASC']);
    }

    /**
     * @template T of object
     *
     * @param class-string<T>       $class
     * @param array<string, string> $orderBy
     *
     * @return list<T>
     */
    private function entitiesOf(string $class, Plan $plan, array $orderBy = []): array
    {
        return $this->em()->getRepository($class)->findBy(['planVersion' => $plan->getDraft()], $orderBy);
    }

    private function factory(): PlanFactory
    {
        return static::getContainer()->get(PlanFactory::class);
    }

    private function em(): EntityManagerInterface
    {
        return static::getContainer()->get(EntityManagerInterface::class);
    }
}
