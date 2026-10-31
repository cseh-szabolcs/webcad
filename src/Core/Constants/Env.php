<?php

namespace App\Core\Constants;

enum Env: string
{
    case Dev = 'dev';
    case Prod = 'prod';
    case Test = 'test';

    public function isDev(): bool
    {
        return self::Dev === $this;
    }

    public function isProd(): bool
    {
        return self::Prod === $this;
    }

    public function isTest(): bool
    {
        return self::Test === $this;
    }
}
