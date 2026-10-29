<?php

namespace App\Project;

final readonly class ProjectDTO
{
    public function __construct(
        public string $id,
        public string $name,
    ) {
    }
}
