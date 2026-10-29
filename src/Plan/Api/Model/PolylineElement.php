<?php

namespace App\Plan\Api\Model;

use OpenApi\Attributes as OA;
use Symfony\Component\Validator\Constraints as Assert;

#[OA\Schema(description: 'Straight segments through its vertices in order; a closed one also joins the last to the first.', required: self::ALWAYS_SENT)]
final readonly class PolylineElement extends AbstractElement
{
    public const string TYPE = 'polyline';

    /**
     * @param list<string> $vertexIds
     */
    public function __construct(
        string $id,
        ?string $layerId,
        ?string $groupId,
        ?string $styleId,
        #[Assert\Count(min: 2)]
        public array $vertexIds,
        public bool $closed,
        ?string $name = null,
    ) {
        parent::__construct($id, $layerId, $groupId, $styleId, $name);
    }
}
