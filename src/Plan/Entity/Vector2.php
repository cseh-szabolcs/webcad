<?php

namespace App\Plan\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * A relative offset in model space (mm, Y up), embedded in the element that owns it. Nullable in
 * the database, as the element table is shared by all types (single table inheritance).
 */
#[ORM\Embeddable]
final readonly class Vector2
{
    public function __construct(
        #[ORM\Column(nullable: true)]
        public float $x,
        #[ORM\Column(nullable: true)]
        public float $y,
    ) {
    }
}
