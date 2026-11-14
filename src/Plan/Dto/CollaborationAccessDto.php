<?php

namespace App\Plan\Dto;

use OpenApi\Attributes as OA;
use Symfony\Component\Validator\Constraints as Assert;

#[OA\Schema(description: 'What the editor needs to join the collaboration room of a plan\'s project: it connects to the namespace and shows the token in the handshake.')]
final readonly class CollaborationAccessDto
{
    public function __construct(
        #[Assert\Uuid]
        #[OA\Property(description: 'The socket namespace: the uuid of the tenant.', format: 'uuid')]
        public string $namespace,
        #[Assert\Uuid]
        #[OA\Property(description: 'The room: the id of the plan\'s project.', format: 'uuid')]
        public string $room,
        #[OA\Property(description: 'How the user is shown to the others.', example: 'Erika Muster')]
        public string $userName,
        #[OA\Property(description: 'Signed and short-lived; only valid for this namespace and room.')]
        public string $token,
    ) {
    }
}
