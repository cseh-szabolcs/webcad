<?php

namespace App\Plan\Query;

use Symfony\Component\Uid\Uuid;

final readonly class GetPlanDocumentQuery
{
    public function __construct(
        public Uuid $planId,
    ) {
    }
}
