<?php

namespace App\Plan\Props;

final readonly class PolylineProps implements ElementPropsInterface
{
    public const string TYPE = 'polyline';

    public function __construct(
        /** A closed polyline also joins its last vertex to the first. */
        public bool $closed,
    ) {
    }
}
