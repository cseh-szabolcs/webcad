<?php

namespace App\Tests\Core\Doctrine\Fixtures;

/**
 * A plain object for JsonDocumentTypeTest.
 */
final readonly class Point
{
    public function __construct(
        public float $x,
        public float $y,
    ) {
    }
}
