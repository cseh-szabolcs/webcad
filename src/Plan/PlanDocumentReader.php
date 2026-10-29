<?php

namespace App\Plan;

use App\Plan\Dto\ArcElementDto;
use App\Plan\Dto\BezierElementDto;
use App\Plan\Dto\CircleElementDto;
use App\Plan\Dto\ElementDtoInterface;
use App\Plan\Dto\ElementStyleDto;
use App\Plan\Dto\EllipseElementDto;
use App\Plan\Dto\GroupDto;
use App\Plan\Dto\LayerDto;
use App\Plan\Dto\LineElementDto;
use App\Plan\Dto\PlanDocumentDto;
use App\Plan\Dto\PolylineElementDto;
use App\Plan\Dto\Vector2Dto;
use App\Plan\Dto\VertexDto;
use App\Plan\Entity\PlanVersion;
use App\Plan\Repository\ElementRepository;
use App\Plan\Repository\ElementStyleRepository;
use App\Plan\Repository\GroupRepository;
use App\Plan\Repository\LayerRepository;
use App\Plan\Repository\VertexRepository;

/**
 * Reads one version of a plan with all its contents into a document, as stored in the database.
 * Vertices, groups and styles have no order of their own and come in the order of their ids,
 * which for UUIDv7 is the order they were made. Each element becomes the `…ElementDto` of its type.
 */
final readonly class PlanDocumentReader
{
    public function __construct(
        private VertexRepository $vertices,
        private LayerRepository $layers,
        private GroupRepository $groups,
        private ElementStyleRepository $styles,
        private ElementRepository $elements,
    ) {
    }

    public function read(PlanVersion $version): PlanDocumentDto
    {
        $plan = $version->getPlan();

        return new PlanDocumentDto(
            id: $plan->getId()->toRfc4122(),
            name: $plan->getName(),
            schemaVersion: PlanDocumentDto::SCHEMA_VERSION,
            unit: $version->getUnit(),
            vertices: array_map(
                static fn (Entity\Vertex $v): VertexDto => new VertexDto($v->getId()->toRfc4122(), $v->getX(), $v->getY()),
                $this->vertices->findByPlanVersion($version),
            ),
            elements: array_map($this->element(...), $this->elements->findByPlanVersion($version)),
            layers: array_map(
                static fn (Entity\Layer $l): LayerDto => new LayerDto($l->getId()->toRfc4122(), $l->getName(), $l->isVisible(), $l->isLocked()),
                $this->layers->findByPlanVersion($version),
            ),
            groups: array_map(
                static fn (Entity\Group $g): GroupDto => new GroupDto($g->getId()->toRfc4122(), $g->getName()),
                $this->groups->findByPlanVersion($version),
            ),
            styles: array_map(
                static fn (Entity\ElementStyle $s): ElementStyleDto => new ElementStyleDto(
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

    private function element(Entity\Element $element): ElementDtoInterface
    {
        $id = $element->getId()->toRfc4122();
        $layerId = $element->getLayer()?->getId()->toRfc4122();
        $groupId = $element->getGroup()?->getId()->toRfc4122();
        $styleId = $element->getStyle()?->getId()->toRfc4122();
        $vertex = static fn (Entity\Vertex $v): string => $v->getId()->toRfc4122();
        $vector = static fn (Entity\Vector2 $v): Vector2Dto => new Vector2Dto($v->x, $v->y);

        return match (true) {
            $element instanceof Entity\LineElement => new LineElementDto(
                $id, $layerId, $groupId, $styleId,
                startVertexId: $vertex($element->getStartVertex()),
                endVertexId: $vertex($element->getEndVertex()),
                name: $element->getName(),
            ),
            $element instanceof Entity\PolylineElement => new PolylineElementDto(
                $id, $layerId, $groupId, $styleId,
                vertexIds: array_map($vertex, $element->getVertices()),
                closed: $element->isClosed(),
                name: $element->getName(),
            ),
            $element instanceof Entity\ArcElement => new ArcElementDto(
                $id, $layerId, $groupId, $styleId,
                centerVertexId: $vertex($element->getCenterVertex()),
                startVertexId: $vertex($element->getStartVertex()),
                endVertexId: $vertex($element->getEndVertex()),
                clockwise: $element->isClockwise(),
                name: $element->getName(),
            ),
            $element instanceof Entity\CircleElement => new CircleElementDto(
                $id, $layerId, $groupId, $styleId,
                centerVertexId: $vertex($element->getCenterVertex()),
                radius: $element->getRadius(),
                name: $element->getName(),
            ),
            $element instanceof Entity\EllipseElement => new EllipseElementDto(
                $id, $layerId, $groupId, $styleId,
                centerVertexId: $vertex($element->getCenterVertex()),
                radiusX: $element->getRadiusX(),
                radiusY: $element->getRadiusY(),
                rotation: $element->getRotation(),
                name: $element->getName(),
            ),
            $element instanceof Entity\BezierElement => new BezierElementDto(
                $id, $layerId, $groupId, $styleId,
                startVertexId: $vertex($element->getStartVertex()),
                endVertexId: $vertex($element->getEndVertex()),
                startControl: $vector($element->getStartControl()),
                endControl: $vector($element->getEndControl()),
                name: $element->getName(),
            ),
            default => throw new \LogicException(\sprintf('No Dto for element type %s.', $element::class)),
        };
    }
}
