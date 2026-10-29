<?php

namespace App\Plan\Api;

use Symfony\Component\Uid\Uuid;

final readonly class GetPlanDocumentQuery
{
    public function __construct(
        public Uuid $planId,
    ) {
    }
}
