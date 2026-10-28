<?php

namespace App\Application\Model\Plan;

use OpenApi\Attributes as OA;
use Symfony\Component\Validator\Constraints as Assert;

#[OA\Schema(description: 'A layer of the plan. Elements on a hidden layer are neither drawn nor snapped to; those on a locked one cannot be selected.')]
final readonly class Layer
{
    public function __construct(
        #[Assert\Uuid]
        #[OA\Property(format: 'uuid')]
        public string $id,
        #[OA\Property(example: 'Walls')]
        public string $name,
        public bool $visible,
        public bool $locked,
    ) {
    }
}
