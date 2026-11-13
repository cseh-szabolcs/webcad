<?php

namespace App\Plan\Dto;

use OpenApi\Attributes as OA;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Context\ExecutionContextInterface;

#[OA\Schema(description: 'Segments through its vertices in order, straight or arcs (see bulges); a closed one also joins the last to the first.', required: self::ALWAYS_SENT)]
final readonly class PolylineElementDto extends AbstractElementDto
{
    public const string TYPE = 'polyline';

    /**
     * @param list<string> $vertexIds
     * @param list<float>  $bulges
     */
    public function __construct(
        string $id,
        ?string $layerId,
        ?string $groupId,
        ?string $styleId,
        #[Assert\Count(min: 2)]
        public array $vertexIds,
        public bool $closed,
        #[OA\Property(description: 'One per vertex, for the segment from it to the next (the last one of an open polyline is unused): 0 for a straight segment, else the tangent of a quarter of the angle its arc spans, like a DXF bulge; positive counter-clockwise (Y up), 1 is half a circle.', example: [0, 0.4142, 0, 0])]
        #[Assert\All([new Assert\Type('numeric')])]
        public array $bulges,
        ?string $name = null,
    ) {
        parent::__construct($id, $layerId, $groupId, $styleId, $name);
    }

    #[Assert\Callback]
    public function validateBulges(ExecutionContextInterface $context): void
    {
        if (\count($this->bulges) !== \count($this->vertexIds)) {
            $context->buildViolation('A polyline needs one bulge per vertex.')->atPath('bulges')->addViolation();
        }
    }
}
