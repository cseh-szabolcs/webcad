<?php

namespace App\Tests\Plan;

use App\Core\Tenancy\TenantSwitcher;
use App\Fixtures\Console\FixtureCreateCommand;
use App\Plan\Dto\LineElementDto;
use App\Plan\Dto\PlanDocumentDto;
use App\Plan\Entity;
use App\Plan\Entity\Element;
use App\Plan\Entity\Plan;
use App\Plan\Entity\Vector2;
use App\Plan\Enum\PlanUnit;
use App\Plan\PlanFactory;
use App\Project\Entity\Project;
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

        self::assertSame('Sample apartment', $plan->getName());
        self::assertSame(PlanUnit::Millimetre, $plan->getDraft()->getUnit());
        self::assertNotSame($document->id, $plan->getId()->toRfc4122());

        $elements = $this->elementsOf($plan);
        self::assertSame(
            [
                'Wall outer',
                'Wall inner',
                'Door leaf',
                'Door swing',
                'Window',
                'Table',
                'Sofa',
                'Axis',
                'Rug',
                'Curtain',
                'Wall kitchen',
                'Wall bedroom',
                'Wall bath',
                'Door leaf',
                'Door swing',
                'Door leaf',
                'Door swing',
                'Door leaf',
                'Door swing',
                'Window bedroom',
                'Window living',
                'Window bath',
                'Bed',
                'Pillow left',
                'Pillow right',
                'Bathtub',
                'Kitchen counter',
                'Sink',
            ],
            array_map(static fn (Element $e): ?string => $e->getName(), $elements),
        );
        self::assertCount(72, $this->entitiesOf(Entity\Vertex::class, $plan));
        self::assertCount(4, $this->entitiesOf(Entity\Group::class, $plan));
        self::assertCount(4, $this->entitiesOf(Entity\ElementStyle::class, $plan));

        $layers = $this->entitiesOf(Entity\Layer::class, $plan, ['position' => 'ASC']);
        self::assertSame(['0', 'Walls', 'Doors & windows', 'Furniture'], array_map(static fn (Entity\Layer $l): string => $l->getName(), $layers));
        self::assertSame(['#000000', '#1f2937', '#374151', '#2563eb'], array_map(static fn (Entity\Layer $l): string => $l->getColor(), $layers));
        self::assertSame([25, 50, 25, 25], array_map(static fn (Entity\Layer $l): int => $l->getLineweight(), $layers));

        $floors = $this->entitiesOf(Entity\Floor::class, $plan, ['position' => 'ASC']);
        self::assertSame(['Ground floor'], array_map(static fn (Entity\Floor $f): string => $f->getName(), $floors));
        foreach ($layers as $layer) {
            self::assertSame($floors[0], $layer->getFloor());
        }

        $documentIds = [];
        foreach ([...$document->vertices, ...$document->floors, ...$document->layers, ...$document->groups, ...$document->styles] as $model) {
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
        self::assertSame($wallOuter->getVertices()[3], $axis->getStartVertex());
        self::assertSame($table->getCenterVertex(), $rug->getCenterVertex());
        self::assertSame($doorSwing->getEndVertex(), $doorLeaf->getEndVertex());

        self::assertSame('Walls', $wallOuter->getLayer()->getName());
        self::assertSame('Wall', $wallOuter->getStyle()->getName());
        self::assertTrue($wallOuter->isClosed());
        self::assertSame('Door D1', $doorLeaf->getGroup()->getName());
        self::assertSame('0', $axis->getLayer()->getName());
        // Drawn with the colour, linetype and transparency of its layer
        self::assertNull($doorLeaf->getStyle());
        self::assertNull($axis->getStyle());
        self::assertSame(600.0, $table->getRadius());
        self::assertSame([1000.0, 700.0, 0.0], [$rug->getRadiusX(), $rug->getRadiusY(), $rug->getRotation()]);
        self::assertFalse($doorSwing->isClockwise());
        self::assertEquals(new Vector2(500.0, -200.0), $curtain->getStartControl());
        self::assertEquals(new Vector2(-500.0, -200.0), $curtain->getEndControl());
        // The curtain overrides colour and lineweight, the table nothing
        self::assertSame(['#b45309', null, 50, null], [$curtain->getColor(), $curtain->getLinetype(), $curtain->getLineweight(), $curtain->getTransparency()]);
        self::assertSame([null, null, null, null], [$table->getColor(), $table->getLinetype(), $table->getLineweight(), $table->getTransparency()]);
    }

    public function testFurtherVersionIsAddedToThePlan(): void
    {
        $plan = $this->createAndReload($this->sampleDocument());

        $document = $this->sampleDocument();
        $document = new PlanDocumentDto($document->id, 'Other name', $document->schemaVersion, PlanUnit::Metre, $document->vertices, $document->elements, $document->floors, $document->layers, $document->groups, $document->styles);
        $version = $this->factory()->createVersion($plan, $document);
        $this->em()->flush();

        self::assertSame($plan, $version->getPlan());
        self::assertNotSame($plan->getDraft(), $version);
        self::assertSame(PlanUnit::Metre, $version->getUnit());
        self::assertNull($version->getNumber());
        self::assertSame('Sample apartment', $plan->getName());
        self::assertCount(28, $this->em()->getRepository(Element::class)->findBy(['planVersion' => $version]));
        self::assertCount(28, $this->elementsOf($plan));
    }

    public function testUnknownReferenceIsRejected(): void
    {
        $document = $this->sampleDocument();
        $elements = $document->elements;
        $elements[] = new LineElementDto(Uuid::v7()->toRfc4122(), $document->layers[0]->id, null, null, $document->vertices[0]->id, Uuid::v7()->toRfc4122());

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessageMatches('/unknown vertex/');

        $this->factory()->create(new Project(Uuid::v7(), 'P'), $this->withElements($document, $elements));
    }

    public function testUnknownLayerIsRejected(): void
    {
        $document = $this->sampleDocument();
        $elements = $document->elements;
        $elements[] = new LineElementDto(Uuid::v7()->toRfc4122(), Uuid::v7()->toRfc4122(), null, null, $document->vertices[0]->id, $document->vertices[1]->id);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessageMatches('/unknown layer/');

        $this->factory()->create(new Project(Uuid::v7(), 'P'), $this->withElements($document, $elements));
    }

    public function testLayerOfAnUnknownFloorIsRejected(): void
    {
        $d = $this->sampleDocument();

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessageMatches('/unknown floor/');

        $this->factory()->create(new Project(Uuid::v7(), 'P'), new PlanDocumentDto($d->id, $d->name, $d->schemaVersion, $d->unit, $d->vertices, $d->elements, [], $d->layers, $d->groups, $d->styles));
    }

    public function testOtherSchemaVersionIsRejected(): void
    {
        $document = $this->sampleDocument();
        $document = new PlanDocumentDto($document->id, $document->name, 2, $document->unit, $document->vertices, $document->elements, $document->floors, $document->layers, $document->groups, $document->styles);

        $this->expectException(\InvalidArgumentException::class);

        $this->factory()->create(new Project(Uuid::v7(), 'P'), $document);
    }

    private function sampleDocument(): PlanDocumentDto
    {
        $json = file_get_contents(static::getContainer()->getParameter('kernel.project_dir').FixtureCreateCommand::SAMPLE_PLAN);

        return static::getContainer()->get(SerializerInterface::class)->deserialize($json, PlanDocumentDto::class, 'json');
    }

    /**
     * @param list<\App\Plan\Dto\ElementDtoInterface> $elements
     */
    private function withElements(PlanDocumentDto $d, array $elements): PlanDocumentDto
    {
        return new PlanDocumentDto($d->id, $d->name, $d->schemaVersion, $d->unit, $d->vertices, $elements, $d->floors, $d->layers, $d->groups, $d->styles);
    }

    private function createAndReload(PlanDocumentDto $document): Plan
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
