<?php

namespace App\Core\Contracts;

use Symfony\Component\Uid\Uuid;

interface UuidAwareInterface
{
    public function getUuid(): Uuid;
}
