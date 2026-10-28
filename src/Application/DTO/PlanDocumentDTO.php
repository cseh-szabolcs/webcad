<?php

namespace App\Application\DTO;

use App\Application\Model\Plan\PlanDocument;

final readonly class PlanDocumentDTO
{
    public function __construct(
        public PlanDocument $document,
        // Not part of the document: the API sends it as the ETag
        public int $revision,
    ) {
    }
}
