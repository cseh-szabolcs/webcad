<?php

namespace App\Core\Routing;

use Symfony\Component\Config\Loader\Loader;
use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;
use Symfony\Component\Routing\RouteCollection;

/**
 * Puts the locale in front of the imported routes (/{_locale}/…), so a page route only names its own
 * path. Routes under UNLOCALIZED_PATHS keep their path, as do routes declared with #[GlobalRoute] (which
 * sets the option OPTION to false, e.g. the root redirect). The requirement of {_locale} comes from
 * framework.enabled_locales.
 */
#[AutoconfigureTag('routing.loader')]
final class LocalizedRouteLoader extends Loader
{
    public const string TYPE = 'localized';

    public const string OPTION = 'localized';

    /** Path prefixes without locale: the API speaks JSON, the admin area is not translated. */
    private const array UNLOCALIZED_PATHS = ['/admin', '/api'];

    public function load(mixed $resource, ?string $type = null): RouteCollection
    {
        $routes = $this->import($resource);

        foreach ($routes as $route) {
            $path = $route->getPath();
            if (false === $route->getOption(self::OPTION) || self::isUnlocalized($path)) {
                continue;
            }

            $route->setPath('/{_locale}'.('/' === $path ? '' : $path));
        }

        return $routes;
    }

    public function supports(mixed $resource, ?string $type = null): bool
    {
        return self::TYPE === $type;
    }

    private static function isUnlocalized(string $path): bool
    {
        foreach (self::UNLOCALIZED_PATHS as $prefix) {
            if ($path === $prefix || str_starts_with($path, $prefix.'/')) {
                return true;
            }
        }

        return false;
    }
}
