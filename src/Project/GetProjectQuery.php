<?php

namespace App\Project;

use Symfony\Component\Uid\Uuid;

final readonly class GetProjectQuery
{
    public function __construct(
        public Uuid $id,
    ) {
    }
}
