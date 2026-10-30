<?php

namespace App\Core\Traits;

use App\Core\Constants\Env;
use Symfony\Contracts\Service\Attribute\Required;

trait EnvAwareTrait
{
    protected Env $env;

    #[Required]
    public function setEnv(string $env): void
    {
        $this->env = Env::from($env);
    }
}
