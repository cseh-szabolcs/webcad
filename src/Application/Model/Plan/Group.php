<?php

namespace App\Application\Model\Plan;

use OpenApi\Attributes as OA;
use Symfony\Component\Validator\Constraints as Assert;

#[OA\Schema(description: 'Elements that are picked together. Membership is stored on the element (groupId).')]
final readonly class Group
{
    public function __construct(
        #[Assert\Uuid]
        #[OA\Property(format: 'uuid')]
        public string $id,
        #[OA\Property(example: 'Door D1')]
        public string $name,
    ) {
    }
}
