<?php

namespace App\Core\Contracts;

interface EmailAwareInterface
{
    public function getEmail(): string;
}
