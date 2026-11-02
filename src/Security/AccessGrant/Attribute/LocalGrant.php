<?php

namespace App\Security\AccessGrant\Attribute;

use App\Core\Constants\Env;

#[\Attribute(\Attribute::TARGET_CLASS | \Attribute::TARGET_METHOD)]
readonly class LocalGrant extends EnvGrant
{
    public function __construct()
    {
        parent::__construct(env: [Env::Dev, Env::Test]);
    }
}
