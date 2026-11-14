<?php

namespace App\Plan\Query;

use Symfony\Component\Uid\Uuid;

final readonly class GetPlanCollaborationQuery
{
    public function __construct(
        public Uuid $planId,
        public Uuid $userId,
        public string $userName,
    ) {
    }
}
