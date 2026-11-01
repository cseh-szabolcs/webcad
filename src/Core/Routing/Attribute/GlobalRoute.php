<?php

namespace App\Core\Routing\Attribute;

use App\Core\Routing\LocalizedRouteLoader;
use Symfony\Component\Routing\Attribute\Route;

/**
 * A route without the locale prefix (LocalizedRouteLoader), e.g. the root redirect; takes the arguments of
 * #[Route]. On a class, it keeps all routes of that controller without locale.
 */
#[\Attribute(\Attribute::IS_REPEATABLE | \Attribute::TARGET_CLASS | \Attribute::TARGET_METHOD)]
final class GlobalRoute extends Route
{
    public function __construct(mixed ...$args)
    {
        parent::__construct(...$args);
        $this->options[LocalizedRouteLoader::OPTION] = false;
    }
}
