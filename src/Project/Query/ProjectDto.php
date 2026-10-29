<?php

namespace App\Project\Query;

final readonly class ProjectDto
{
    public function __construct(
        public string $id,
        public string $name,
    ) {
    }
}
