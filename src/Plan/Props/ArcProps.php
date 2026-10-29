<?php

namespace App\Plan\Props;

final readonly class ArcProps implements ElementPropsInterface
{
    public const string TYPE = 'arc';

    public function __construct(
        /** Direction from start to end, Y up: false is counter-clockwise. */
        public bool $clockwise,
    ) {
    }
}
