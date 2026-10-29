<?php

namespace App\Plan\Props;

use Symfony\Component\Validator\Constraints as Assert;

final readonly class CircleProps implements ElementPropsInterface
{
    public const string TYPE = 'circle';

    public function __construct(
        #[Assert\Positive]
        public float $radius,
    ) {
    }
}
