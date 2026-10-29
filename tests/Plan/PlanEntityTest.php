<?php

namespace App\Tests\Plan;

use App\Core\Tenancy\TenantSwitcher;
use App\Plan\Entity\ArcElement;
use App\Plan\Entity\BezierElement;
use App\Plan\Entity\CircleElement;
use App\Plan\Entity\Element;
use App\Plan\Entity\ElementStyle;
use App\Plan\Entity\EllipseElement;
use App\Plan\Entity\Group;
use App\Plan\Entity\Layer;
use App\Plan\Entity\LineElement;
use App\Plan\Entity\Plan;
use App\Plan\Entity\PlanVersion;
use App\Plan\Entity\PolylineElement;
use App\Plan\Entity\Vertex;
use App\Plan\Enum\PlanUnit;
use App\Plan\Props\ArcProps;
use App\Plan\Props\BezierProps;
use App\Plan\Props\CircleProps;
use App\Plan\Props\EllipseProps;
use App\Plan\Props\LineProps;
use App\Plan\Props\PolylineProps;
use App\Plan\Props\Vector2;
use App\Project\Entity\Project;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Uid\Uuid;

final class PlanEntityTest extends KernelTestCase
{
    protected function setUp(): void
    {
        // Without a request or console command, nothing selects the tenant (see .env.test)
        static::getContainer()->get(TenantSwitcher::class)->switchTo($_ENV['DEFAULT_TENANT']);
    }

    public function testPlanWithEveryElementTypeIsStoredAndLoaded(): void
    {
        $em = static::getContainer()->get(EntityManagerInterface::class);

        $project = new Project(Uuid::v7(), 'Einfamilienhaus');
        $plan = new Plan(Uuid::v7(), $project, 'Erdgeschoss', PlanUnit::Centimetre);
        $draft = $plan->getDraft();
        $walls = new Layer(Uuid::v7(), $draft, 0, 'Walls');
        $hidden = new Layer(Uuid::v7(), $draft, 1, 'Hidden', visible: false, locked: true);
        $door = new Group(Uuid::v7(), $draft, 'Door D1');
        $dashed = new ElementStyle(Uuid::v7(), $draft, 'Dashed', '#374151', 1.0, [8.0, 4.0], '#f3f4f6');
        $a = new Vertex(Uuid::v7(), $draft, 0.0, 0.0);
        $b = new Vertex(Uuid::v7(), $draft, 6000.0, 0.0);
        $c = new Vertex(Uuid::v7(), $draft, 6000.0, 4000.5);

        $elements = [
            $polyline = new PolylineElement(Uuid::v7(), $draft, 0, [$a, $b, $c, $a], new PolylineProps(false), $walls, name: 'Wall'),
            $line = new LineElement(Uuid::v7(), $draft, 1, $a, $c, style: $dashed),
            $arc = new ArcElement(Uuid::v7(), $draft, 2, $a, $b, $c, new ArcProps(true), $hidden, $door),
            $circle = new CircleElement(Uuid::v7(), $draft, 3, $b, new CircleProps(600.0)),
            $ellipse = new EllipseElement(Uuid::v7(), $draft, 4, $b, new EllipseProps(1000.0, 700.0, 0.5)),
            $bezier = new BezierElement(Uuid::v7(), $draft, 5, $a, $b, new BezierProps(new Vector2(500.0, -200.0), new Vector2(-500.0, -200.0))),
        ];

        foreach ([$project, $plan, $walls, $hidden, $door, $dashed, $a, $b, $c, ...$elements] as $entity) {
            $em->persist($entity);
        }
        $em->flush();
        $em->clear();

        $loaded = $em->find(Plan::class, $plan->getId());
        self::assertSame('Erdgeschoss', $loaded->getName());
        self::assertSame(0, $loaded->getVersion());
        self::assertNull($loaded->getHead());
        self::assertSame(PlanUnit::Centimetre, $loaded->getDraft()->getUnit());
        self::assertSame(1, $loaded->getDraft()->getRevision());
        self::assertNull($loaded->getDraft()->getNumber());
        self::assertNull($loaded->getDraft()->getName());
        self::assertSame($loaded, $loaded->getDraft()->getPlan());

        $stored = $em->getRepository(Element::class)->findBy(['planVersion' => $loaded->getDraft()], ['position' => 'ASC']);
        self::assertSame(
            [PolylineElement::class, LineElement::class, ArcElement::class, CircleElement::class, EllipseElement::class, BezierElement::class],
            array_map(static fn (Element $e): string => $e::class, $stored),
        );
        [$polyline, $line, $arc, $circle, $ellipse, $bezier] = $stored;

        // The polyline keeps its order and the vertex it repeats; the line shares two of its vertices
        self::assertEquals([$a->getId(), $b->getId(), $c->getId(), $a->getId()], array_map(static fn (Vertex $v): Uuid => $v->getId(), $polyline->getVertices()));
        self::assertSame($polyline->getVertices()[0], $line->getStartVertex());
        self::assertSame('Wall', $polyline->getName());
        self::assertSame('Walls', $polyline->getLayer()->getName());
        self::assertEquals(new PolylineProps(false), $polyline->getProps());
        self::assertEquals(new LineProps(), $line->getProps());

        self::assertNull($line->getLayer());
        self::assertSame([8.0, 4.0], $line->getStyle()->getDashPattern());
        self::assertSame('#f3f4f6', $line->getStyle()->getFillColor());
        self::assertSame(4000.5, $line->getEndVertex()->getY());

        self::assertEquals(new ArcProps(true), $arc->getProps());
        self::assertSame('Door D1', $arc->getGroup()->getName());
        self::assertFalse($arc->getLayer()->isVisible());
        self::assertTrue($arc->getLayer()->isLocked());

        self::assertEquals(new CircleProps(600.0), $circle->getProps());
        self::assertEquals(new EllipseProps(1000.0, 700.0, 0.5), $ellipse->getProps());
        self::assertEquals(new BezierProps(new Vector2(500.0, -200.0), new Vector2(-500.0, -200.0)), $bezier->getProps());

        // Stored as a JSON document with the class that it is read back into
        self::assertJsonStringEqualsJsonString(
            '{"#type": "App\\\\Plan\\\\Props\\\\EllipseProps", "type": "ellipse", "radiusX": 1000.0, "radiusY": 700.0, "rotation": 0.5}',
            $em->getConnection()->fetchOne('SELECT props FROM element WHERE id = ?', [$ellipse->getId()->toBinary()]),
        );
    }

    public function testPolylineNeedsTwoVertices(): void
    {
        $draft = $this->newPlan()->getDraft();

        $this->expectException(\InvalidArgumentException::class);

        new PolylineElement(Uuid::v7(), $draft, 0, [new Vertex(Uuid::v7(), $draft, 0.0, 0.0)], new PolylineProps(false));
    }

    public function testPublishMakesTheCopyTheNumberedHead(): void
    {
        $plan = $this->newPlan();
        $first = new PlanVersion(Uuid::v7(), $plan, PlanUnit::Millimetre);
        $second = new PlanVersion(Uuid::v7(), $plan, PlanUnit::Millimetre);

        $plan->publish($first, 'Baueingabe');
        $plan->publish($second);

        self::assertSame(2, $plan->getVersion());
        self::assertSame($second, $plan->getHead());
        self::assertSame(2, $second->getNumber());
        self::assertSame(1, $first->getNumber());
        self::assertSame('Baueingabe', $first->getName());
        self::assertNull($second->getName());
        self::assertNull($plan->getDraft()->getNumber());
        self::assertNull($plan->getDraft()->getName());
    }

    public function testDraftCannotBePublishedItself(): void
    {
        $plan = $this->newPlan();

        $this->expectException(\InvalidArgumentException::class);

        $plan->publish($plan->getDraft());
    }

    public function testVersionOfAnotherPlanCannotBePublished(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $this->newPlan()->publish($this->newPlan()->getDraft());
    }

    public function testVersionCannotBePublishedTwice(): void
    {
        $plan = $this->newPlan();
        $copy = new PlanVersion(Uuid::v7(), $plan, PlanUnit::Millimetre);
        $plan->publish($copy);

        try {
            $plan->publish($copy);
            self::fail('Published twice.');
        } catch (\InvalidArgumentException) {
            self::assertSame(1, $plan->getVersion());
        }
    }

    /**
     * Plan and version refer to each other; deleting the project must still remove everything.
     */
    public function testDeletingTheProjectRemovesPlanVersionsAndContents(): void
    {
        $em = static::getContainer()->get(EntityManagerInterface::class);
        $plan = $this->newPlan();
        $draft = $plan->getDraft();
        $head = new PlanVersion(Uuid::v7(), $plan, PlanUnit::Millimetre);
        $vertex = new Vertex(Uuid::v7(), $draft, 0.0, 0.0);
        $line = new LineElement(Uuid::v7(), $head, 0, $headVertex = new Vertex(Uuid::v7(), $head, 0.0, 0.0), $headVertex);
        $plan->publish($head);
        foreach ([$plan->getProject(), $plan, $head, $vertex, $headVertex, $line] as $entity) {
            $em->persist($entity);
        }
        $em->flush();
        $em->clear();

        $connection = $em->getConnection();
        $connection->executeStatement('DELETE FROM project WHERE id = ?', [$plan->getProject()->getId()->toBinary()]);

        $versions = [$draft->getId()->toBinary(), $head->getId()->toBinary()];
        self::assertSame(0, (int) $connection->fetchOne('SELECT COUNT(*) FROM plan WHERE id = ?', [$plan->getId()->toBinary()]));
        self::assertSame(0, (int) $connection->fetchOne('SELECT COUNT(*) FROM plan_version WHERE id IN (?, ?)', $versions));
        self::assertSame(0, (int) $connection->fetchOne('SELECT COUNT(*) FROM vertex WHERE plan_version_id IN (?, ?)', $versions));
        self::assertSame(0, (int) $connection->fetchOne('SELECT COUNT(*) FROM element WHERE plan_version_id IN (?, ?)', $versions));
    }

    private function newPlan(): Plan
    {
        return new Plan(Uuid::v7(), new Project(Uuid::v7(), 'P'), 'Plan', PlanUnit::Millimetre);
    }
}
