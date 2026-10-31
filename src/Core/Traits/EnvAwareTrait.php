<?php

namespace App\Core\Traits;

use App\Core\Constants\Env;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Contracts\Service\Attribute\Required;

/**
 * Gives a service the environment the kernel was booted in, as an Env.
 */
trait EnvAwareTrait
{
    protected Env $env;

    #[Required]
    public function setEnv(#[Autowire(param: 'kernel.environment')] string $env): void
    {
        $this->env = Env::from($env);
    }

    public function isDev(): bool
    {
        return $this->env->isDev();
    }

    public function isProd(): bool
    {
        return $this->env->isProd();
    }

    public function isTest(): bool
    {
        return $this->env->isTest();
    }
}
