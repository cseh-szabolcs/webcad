<?php

namespace App\Application\DTO;

final readonly class PlanDocumentDTO
{
    public function __construct(
        public string $planId,
        public int $revision,
        // Kept as raw JSON: decoding to PHP arrays would turn empty objects into lists
        public string $documentJson,
    ) {
    }
}
