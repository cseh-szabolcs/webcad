<?php

namespace App\Plan\Query;

use App\Core\Contracts\SerializableResponseInterface;
use App\Plan\Dto\PlanDocumentDto;

final readonly class PlanDocumentResult implements SerializableResponseInterface
{
    public function __construct(
        public PlanDocumentDto $document,
        // Not part of the document: the API sends it as the ETag
        public int $revision,
    ){
    }

    public function getSerializationContext(): ?array
    {
        return null;
    }

    public function getResponseEtag(): ?string
    {
        return (string) $this->revision;
    }
}
