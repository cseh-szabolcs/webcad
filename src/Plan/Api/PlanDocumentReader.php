<?php

namespace App\Plan\Api;

use App\Plan\Api\Model\ElementInterface;
use App\Plan\Api\Model\ElementStyle;
use App\Plan\Api\Model\Group;
use App\Plan\Api\Model\Layer;
use App\Plan\Api\Model\PlanDocument;
use App\Plan\Api\Model\Vertex;
use App\Plan\Entity;
use App\Plan\Entity\PlanVersion;
use App\Plan\Repository\ElementRepository;
use App\Plan\Repository\ElementStyleRepository;
use App\Plan\Repository\GroupRepository;
use App\Plan\Repository\LayerRepository;
use App\Plan\Repository\VertexRepository;
use Symfony\Component\Serializer\Normalizer\DenormalizerInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;

/**
 * Reads one version of a plan with all its contents into a document, as stored in the database.
 * Vertices, groups and styles have no order of their own and come in the order of their ids,
 * which for UUIDv7 is the order they were made. An element is its references and its props
 * together, built by the serializer from the props' "type".
 */
final readonly class PlanDocumentReader
{
    public function __construct(
        private VertexRepository $vertices,
        private LayerRepository $layers,
        private GroupRepository $groups,
        private ElementStyleRepository $styles,
        private ElementRepository $elements,
        private NormalizerInterface $normalizer,
        private DenormalizerInterface $denormalizer,
    ) {
    }

    public function read(PlanVersion $version): PlanDocument
    {
        $plan = $version->getPlan();

        return new PlanDocument(
            id: $plan->getId()->toRfc4122(),
            name: $plan->getName(),
            schemaVersion: PlanDocument::SCHEMA_VERSION,
            unit: $version->getUnit(),
            vertices: array_map(
                static fn (Entity\Vertex $v): Vertex => new Vertex($v->getId()->toRfc4122(), $v->getX(), $v->getY()),
                $this->vertices->findByPlanVersion($version),
            ),
            elements: array_map($this->element(...), $this->elements->findByPlanVersion($version)),
            layers: array_map(
                static fn (Entity\Layer $l): Layer => new Layer($l->getId()->toRfc4122(), $l->getName(), $l->isVisible(), $l->isLocked()),
                $this->layers->findByPlanVersion($version),
            ),
            groups: array_map(
                static fn (Entity\Group $g): Group => new Group($g->getId()->toRfc4122(), $g->getName()),
                $this->groups->findByPlanVersion($version),
            ),
            styles: array_map(
                static fn (Entity\ElementStyle $s): ElementStyle => new ElementStyle(
                    $s->getId()->toRfc4122(),
                    $s->getName(),
                    $s->getStrokeColor(),
                    $s->getStrokeWidth(),
                    // JSON gives whole numbers back as ints
                    array_map(floatval(...), $s->getDashPattern()),
                    $s->getFillColor(),
                ),
                $this->styles->findByPlanVersion($version),
            ),
        );
    }

    private function element(Entity\Element $element): ElementInterface
    {
        $id = static fn (Entity\Vertex $v): string => $v->getId()->toRfc4122();
        $vertexRefs = match (true) {
            $element instanceof Entity\LineElement, $element instanceof Entity\BezierElement => [
                'startVertexId' => $id($element->getStartVertex()),
                'endVertexId' => $id($element->getEndVertex()),
            ],
            $element instanceof Entity\PolylineElement => ['vertexIds' => array_map($id, $element->getVertices())],
            $element instanceof Entity\ArcElement => [
                'centerVertexId' => $id($element->getCenterVertex()),
                'startVertexId' => $id($element->getStartVertex()),
                'endVertexId' => $id($element->getEndVertex()),
            ],
            $element instanceof Entity\CircleElement, $element instanceof Entity\EllipseElement => [
                'centerVertexId' => $id($element->getCenterVertex()),
            ],
            default => throw new \LogicException(\sprintf('No API model for element type %s.', $element::class)),
        };

        return $this->denormalizer->denormalize([
            'id' => $element->getId()->toRfc4122(),
            'layerId' => $element->getLayer()?->getId()->toRfc4122(),
            'groupId' => $element->getGroup()?->getId()->toRfc4122(),
            'styleId' => $element->getStyle()?->getId()->toRfc4122(),
            'name' => $element->getName(),
            ...$vertexRefs,
            // The display values, with the "type" that picks the model
            ...$this->normalizer->normalize($element->getProps()),
        ], ElementInterface::class);
    }
}
