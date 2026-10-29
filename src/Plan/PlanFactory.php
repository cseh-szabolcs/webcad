<?php

namespace App\Plan;

use App\Plan\Api\Model\ArcElement;
use App\Plan\Api\Model\BezierElement;
use App\Plan\Api\Model\CircleElement;
use App\Plan\Api\Model\EllipseElement;
use App\Plan\Api\Model\LineElement;
use App\Plan\Api\Model\PlanDocument;
use App\Plan\Api\Model\PolylineElement;
use App\Plan\Entity\Plan;
use App\Plan\Entity\PlanVersion;
use App\Plan\Props\ElementPropsInterface;
use App\Project\Entity\Project;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Serializer\Normalizer\DenormalizerInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;
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
        private NormalizerInterface $normalizer,
        private DenormalizerInterface $denormalizer,
    ) {
    }

    /**
     * A new plan whose draft holds the document.
     *
     * @throws \InvalidArgumentException when the document has another schema version or refers
     *                                   to an id it does not contain
     */
    public function create(Project $project, PlanDocument $document, ?Uuid $planId = null): Plan
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
    public function createVersion(Plan $plan, PlanDocument $document): PlanVersion
    {
        self::checkSchemaVersion($document);

        $version = $this->persist(new PlanVersion(Uuid::v7(), $plan, $document->unit));
        $this->fill($version, $document);

        return $version;
    }

    private function fill(PlanVersion $version, PlanDocument $document): void
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

        foreach ($document->elements as $position => $element) {
            $vertex = static fn (string $id): Entity\Vertex => $vertices[$id] ?? throw self::unknown('vertex', $id, $element->id);
            $layer = null === $element->layerId ? null : ($layers[$element->layerId] ?? throw self::unknown('layer', $element->layerId, $element->id));
            $group = null === $element->groupId ? null : ($groups[$element->groupId] ?? throw self::unknown('group', $element->groupId, $element->id));
            $style = null === $element->styleId ? null : ($styles[$element->styleId] ?? throw self::unknown('style', $element->styleId, $element->id));
            $id = Uuid::v7();
            // The display values, picked by "type"; ids and references in the element are ignored
            $props = $this->denormalizer->denormalize($this->normalizer->normalize($element), ElementPropsInterface::class);

            $this->persist(match (true) {
                $element instanceof LineElement => new Entity\LineElement($id, $version, $position, $vertex($element->startVertexId), $vertex($element->endVertexId), $props, $layer, $group, $style, $element->name),
                $element instanceof PolylineElement => new Entity\PolylineElement($id, $version, $position, array_map($vertex, $element->vertexIds), $props, $layer, $group, $style, $element->name),
                $element instanceof ArcElement => new Entity\ArcElement($id, $version, $position, $vertex($element->centerVertexId), $vertex($element->startVertexId), $vertex($element->endVertexId), $props, $layer, $group, $style, $element->name),
                $element instanceof CircleElement => new Entity\CircleElement($id, $version, $position, $vertex($element->centerVertexId), $props, $layer, $group, $style, $element->name),
                $element instanceof EllipseElement => new Entity\EllipseElement($id, $version, $position, $vertex($element->centerVertexId), $props, $layer, $group, $style, $element->name),
                $element instanceof BezierElement => new Entity\BezierElement($id, $version, $position, $vertex($element->startVertexId), $vertex($element->endVertexId), $props, $layer, $group, $style, $element->name),
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

    private static function checkSchemaVersion(PlanDocument $document): void
    {
        if (PlanDocument::SCHEMA_VERSION !== $document->schemaVersion) {
            throw new \InvalidArgumentException(\sprintf('Unsupported schema version %d, expected %d.', $document->schemaVersion, PlanDocument::SCHEMA_VERSION));
        }
    }

    private static function unknown(string $kind, string $id, string $elementId): \InvalidArgumentException
    {
        return new \InvalidArgumentException(\sprintf('Element "%s" refers to unknown %s "%s".', $elementId, $kind, $id));
    }
}
