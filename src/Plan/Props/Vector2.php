<?php

namespace App\Plan\Props;

/**
 * A relative offset in model space (mm, Y up).
 */
final readonly class Vector2
{
    public function __construct(
        public float $x,
        public float $y,
    ) {
    }
}
