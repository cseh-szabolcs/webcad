<?php

namespace App\Tests\Core\Doctrine\Fixtures;

final readonly class CircleShape implements ShapeInterface
{
    public const string TYPE = 'circle';

    public function __construct(
        public float $radius,
        public bool $filled = false,
    ) {
    }
}
