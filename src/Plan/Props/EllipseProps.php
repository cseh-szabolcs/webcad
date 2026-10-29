<?php

namespace App\Plan\Props;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * radiusX along the first axis, radiusY across it (either may be the longer one); the rotation
 * is the angle of the first axis in radians, counter-clockwise from +X (Y up).
 */
final readonly class EllipseProps implements ElementPropsInterface
{
    public const string TYPE = 'ellipse';

    public function __construct(
        #[Assert\Positive]
        public float $radiusX,
        #[Assert\Positive]
        public float $radiusY,
        public float $rotation = 0.0,
    ) {
    }
}
