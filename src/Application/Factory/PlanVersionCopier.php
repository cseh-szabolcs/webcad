<?php

namespace App\Application\Factory;

use App\Application\Reader\PlanDocumentReader;
use App\Domain\Entity\PlanVersion;

/**
 * Copies a version of a plan with all its contents, e.g. the draft before it is published:
 * the version is read as a document and built anew by the factory, which gives every entity a
 * fresh id and rewrites the references between them. Copies what is stored, so changes have to
 * be flushed first. Persists the copy; the caller flushes.
 */
final readonly class PlanVersionCopier
{
    public function __construct(
        private PlanDocumentReader $reader,
        private PlanFactory $factory,
    ) {
    }

    public function copy(PlanVersion $from): PlanVersion
    {
        $document = $this->reader->read($from->getId())
            ?? throw new \InvalidArgumentException(\sprintf('Version "%s" is not stored.', $from->getId()->toRfc4122()));

        return $this->factory->createVersion($from->getPlan(), $document);
    }
}
