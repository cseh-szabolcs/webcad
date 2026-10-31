<?php

namespace App\Core\Constants;

use App\Core\Traits\Pattern\StaticTrait;

final class Http
{
    use StaticTrait;

    const string HEADER_AUTH_TOKEN = 'X-Authorization-Token';
}
