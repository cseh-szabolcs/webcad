<?php

namespace App\Plan\Props;

/**
 * The control vectors of a cubic Bézier curve, each relative to its end vertex, so they move
 * with it.
 */
final readonly class BezierProps implements ElementPropsInterface
{
    public const string TYPE = 'bezier';

    public function __construct(
        public Vector2 $startControl,
        public Vector2 $endControl,
    ) {
    }
}
