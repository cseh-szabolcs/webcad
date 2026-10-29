<?php

namespace App\Plan;

use App\Plan\Dto\ArcElementDto;
use App\Plan\Dto\BezierElementDto;
use App\Plan\Dto\CircleElementDto;
use App\Plan\Dto\EllipseElementDto;
use App\Plan\Dto\LineElementDto;
use App\Plan\Dto\PlanDocumentDto;
use App\Plan\Dto\PolylineElementDto;
use App\Plan\Dto\Vector2Dto;
use App\Plan\Entity\Plan;
use App\Plan\Entity\PlanVersion;
use App\Project\Entity\Project;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Uid\Uuid;

/**
 * Builds plans and plan versions with all their contents from a plan document. Every entity gets
 * a fresh id and the references are rewritten to them, so the same document can be created any
 * number of times. Only a new plan may get a given id. Persists the entities; the caller flushes.
 */
final readonly class PlanFactory
{
    public function __construct(
        private EntityManagerInterface $entityManager,
    ) {
    }

    /**
     * A new plan whose draft holds the document.
     *
     * @throws \InvalidArgumentException when the document has another schema version or refers
     *                                   to an id it does not contain
     */
    public function create(Project $project, PlanDocumentDto $document, ?Uuid $planId = null): Plan
    {
        self::checkSchemaVersion($document);

        $plan = new Plan($planId ?? Uuid::v7(), $project, $document->name, $document->unit);
        $this->entityManager->persist($plan);
        $this->fill($plan->getDraft(), $document);

        return $plan;
    }

    /**
     * A further version of the plan holding the document; the plan's name is kept.
     *
     * @throws \InvalidArgumentException when the document has another schema version or refers
     *                                   to an id it does not contain
     */
    public function createVersion(Plan $plan, PlanDocumentDto $document): PlanVersion
    {
        self::checkSchemaVersion($document);

        $version = $this->persist(new PlanVersion(Uuid::v7(), $plan, $document->unit));
        $this->fill($version, $document);

        return $version;
    }

    private function fill(PlanVersion $version, PlanDocumentDto $document): void
    {
        $vertices = [];
        foreach ($document->vertices as $vertex) {
            $vertices[$vertex->id] = $this->persist(new Entity\Vertex(Uuid::v7(), $version, $vertex->x, $vertex->y));
        }

        $layers = [];
        foreach ($document->layers as $position => $layer) {
            $layers[$layer->id] = $this->persist(new Entity\Layer(Uuid::v7(), $version, $position, $layer->name, $layer->visible, $layer->locked));
        }

        $groups = [];
        foreach ($document->groups as $group) {
            $groups[$group->id] = $this->persist(new Entity\Group(Uuid::v7(), $version, $group->name));
        }

        $styles = [];
        foreach ($document->styles as $style) {
            $styles[$style->id] = $this->persist(new Entity\ElementStyle(Uuid::v7(), $version, $style->name, $style->strokeColor, $style->strokeWidth, $style->dashPattern, $style->fillColor));
        }

        $vector = static fn (Vector2Dto $v): Entity\Vector2 => new Entity\Vector2($v->x, $v->y);
        foreach ($document->elements as $position => $element) {
            $vertex = static fn (string $id): Entity\Vertex => $vertices[$id] ?? throw self::unknown('vertex', $id, $element->id);
            $layer = null === $element->layerId ? null : ($layers[$element->layerId] ?? throw self::unknown('layer', $element->layerId, $element->id));
            $group = null === $element->groupId ? null : ($groups[$element->groupId] ?? throw self::unknown('group', $element->groupId, $element->id));
            $style = null === $element->styleId ? null : ($styles[$element->styleId] ?? throw self::unknown('style', $element->styleId, $element->id));
            $id = Uuid::v7();

            $this->persist(match (true) {
                $element instanceof LineElementDto => new Entity\LineElement($id, $version, $position, $vertex($element->startVertexId), $vertex($element->endVertexId), $layer, $group, $style, $element->name),
                $element instanceof PolylineElementDto => new Entity\PolylineElement($id, $version, $position, array_map($vertex, $element->vertexIds), $element->closed, $layer, $group, $style, $element->name),
                $element instanceof ArcElementDto => new Entity\ArcElement($id, $version, $position, $vertex($element->centerVertexId), $vertex($element->startVertexId), $vertex($element->endVertexId), $element->clockwise, $layer, $group, $style, $element->name),
                $element instanceof CircleElementDto => new Entity\CircleElement($id, $version, $position, $vertex($element->centerVertexId), $element->radius, $layer, $group, $style, $element->name),
                $element instanceof EllipseElementDto => new Entity\EllipseElement($id, $version, $position, $vertex($element->centerVertexId), $element->radiusX, $element->radiusY, $element->rotation, $layer, $group, $style, $element->name),
                $element instanceof BezierElementDto => new Entity\BezierElement($id, $version, $position, $vertex($element->startVertexId), $vertex($element->endVertexId), $vector($element->startControl), $vector($element->endControl), $layer, $group, $style, $element->name),
                default => throw new \LogicException(\sprintf('No entity for element type %s.', $element::class)),
            });
        }
    }

    /**
     * @template T of object
     *
     * @param T $entity
     *
     * @return T
     */
    private function persist(object $entity): object
    {
        $this->entityManager->persist($entity);

        return $entity;
    }

    private static function checkSchemaVersion(PlanDocumentDto $document): void
    {
        if (PlanDocumentDto::SCHEMA_VERSION !== $document->schemaVersion) {
            throw new \InvalidArgumentException(\sprintf('Unsupported schema version %d, expected %d.', $document->schemaVersion, PlanDocumentDto::SCHEMA_VERSION));
        }
    }

    private static function unknown(string $kind, string $id, string $elementId): \InvalidArgumentException
    {
        return new \InvalidArgumentException(\sprintf('Element "%s" refers to unknown %s "%s".', $elementId, $kind, $id));
    }
}
