<?php

namespace App\Plan\Query;

use App\Plan\Dto\PlanDocumentDto;

final readonly class PlanDocumentResult
{
    public function __construct(
        public PlanDocumentDto $document,
        // Not part of the document: the API sends it as the ETag
        public int $revision,
    ) {
    }
}
