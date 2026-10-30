<?php

namespace App\Core\Constants;

enum Env: string
{
    case Dev = 'dev';
    case Prod = 'prod';
    case Test = 'test';

    public function isDev(): bool
    {
        return $this === self::Dev;
    }

    public function isProd(): bool
    {
        return $this === self::Prod;
    }

    public function isTest(): bool
    {
        return $this === self::Test;
    }
}
