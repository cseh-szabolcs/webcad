<?php

namespace App\Application\Model\Plan;

use App\Domain\Enum\PlanUnit;
use OpenApi\Attributes as OA;
use Symfony\Component\Validator\Constraints as Assert;

#[OA\Schema(description: 'The drawing of a plan, as the editor loads it: everything the user drew and the layers, groups and styles it uses. Model coordinates are millimetres with Y up, whatever the display unit.')]
final readonly class PlanDocument
{
    public const int SCHEMA_VERSION = 1;

    /**
     * @param list<Vertex>           $vertices
     * @param list<ElementInterface> $elements
     * @param list<Layer>            $layers
     * @param list<Group>            $groups
     * @param list<ElementStyle>     $styles
     */
    public function __construct(
        #[Assert\Uuid]
        #[OA\Property(description: 'The plan id.', format: 'uuid')]
        public string $id,
        #[OA\Property(description: 'Name of the plan.', example: 'Erdgeschoss')]
        public string $name,
        #[OA\Property(description: 'Version of this format.', example: self::SCHEMA_VERSION)]
        public int $schemaVersion,
        public PlanUnit $unit,
        #[Assert\Valid]
        public array $vertices,
        #[Assert\Valid]
        #[OA\Property(description: 'In document order: within a layer, a later element is drawn on top.')]
        public array $elements,
        #[Assert\Valid]
        #[OA\Property(description: 'In drawing order: a later layer is drawn on top.')]
        public array $layers,
        #[Assert\Valid]
        public array $groups,
        #[Assert\Valid]
        public array $styles,
    ) {
    }
}
