<?php

namespace App\Security\Model;

final readonly class Credentials
{
    public function __construct(
        public string $tenantName,
        public string $identifier,
        public string $password,
    ) {
    }
}
