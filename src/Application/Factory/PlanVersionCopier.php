<?php

namespace App\Application\Factory;

use App\Application\Reader\PlanDocumentReader;
use App\Domain\Entity\PlanVersion;

/**
 * Copies a version of a plan with all its contents, e.g. the draft before it is published:
 * the version is read as a document and built anew by the factory, which gives every entity a
 * fresh id and rewrites the references between them. Copies what the repositories find, which
 * misses contents not flushed yet, so changes have to be flushed first. Persists the copy; the
 * caller flushes.
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
        return $this->factory->createVersion($from->getPlan(), $this->reader->read($from));
    }
}
