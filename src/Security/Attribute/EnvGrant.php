<?php

namespace App\Security\Attribute;

use App\Core\Constants\Env;

#[\Attribute(\Attribute::TARGET_CLASS | \Attribute::TARGET_METHOD)]
readonly class EnvGrant implements GrantInterface
{
    public function __construct(
        /**
         * @var Env[]|Env $env
         */
        public array|Env $env = [Env::Dev, Env::Test],
    ) {
    }
}
