<?php

namespace App\Tests\Core\Doctrine\Fixtures;

final readonly class SegmentShape implements ShapeInterface
{
    public const string TYPE = 'segment';

    public function __construct(
        public Point $start,
        public Point $end,
    ) {
    }
}
