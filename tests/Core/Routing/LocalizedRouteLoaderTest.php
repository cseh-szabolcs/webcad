<?php

namespace App\Tests\Core\Routing;

use App\Core\Routing\Attribute\GlobalRoute;
use App\Core\Routing\LocalizedRouteLoader;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Config\Loader\Loader;
use Symfony\Component\Config\Loader\LoaderResolver;
use Symfony\Component\Routing\Route;
use Symfony\Component\Routing\RouteCollection;
use Symfony\Component\Routing\RouterInterface;

final class LocalizedRouteLoaderTest extends KernelTestCase
{
    public function testPrefixesRoutesWithTheLocale(): void
    {
        $routes = self::load([
            'root' => new Route('/'),
            'login' => new Route('/login'),
            'administration' => new Route('/administration'),
        ]);

        self::assertSame('/{_locale}', $routes->get('root')->getPath());
        self::assertSame('/{_locale}/login', $routes->get('login')->getPath());
        self::assertSame('/{_locale}/administration', $routes->get('administration')->getPath());
    }

    public function testKeepsAdminApiAndUnlocalizedRoutes(): void
    {
        $routes = self::load([
            'admin' => new Route('/admin'),
            'admin_users' => new Route('/admin/users'),
            'api' => new Route('/api/plans/{id}'),
            'redirect' => new Route('/', options: new GlobalRoute('/', name: 'redirect')->options),
        ]);

        self::assertSame('/admin', $routes->get('admin')->getPath());
        self::assertSame('/admin/users', $routes->get('admin_users')->getPath());
        self::assertSame('/api/plans/{id}', $routes->get('api')->getPath());
        self::assertSame('/', $routes->get('redirect')->getPath());
    }

    public function testAppRoutesCarryTheEnabledLocales(): void
    {
        $routes = self::getContainer()->get(RouterInterface::class)->getRouteCollection();

        self::assertSame('/{_locale}/login', $routes->get('user_auth_login')?->getPath());
        self::assertSame('de|en', $routes->get('user_auth_login')->getRequirement('_locale'));
        self::assertSame('/', $routes->get('app_root')?->getPath());
        self::assertStringStartsWith('/api/', $routes->get('api_plan_document_get')?->getPath());
    }

    /**
     * @param array<string, Route> $routes
     */
    private static function load(array $routes): RouteCollection
    {
        $source = new class($routes) extends Loader {
            /** @param array<string, Route> $routes */
            public function __construct(private readonly array $routes)
            {
                parent::__construct();
            }

            public function load(mixed $resource, ?string $type = null): RouteCollection
            {
                $collection = new RouteCollection();
                foreach ($this->routes as $name => $route) {
                    $collection->add($name, $route);
                }

                return $collection;
            }

            public function supports(mixed $resource, ?string $type = null): bool
            {
                return 'source' === $resource && null === $type;
            }
        };

        $loader = new LocalizedRouteLoader();
        $loader->setResolver(new LoaderResolver([$source, $loader]));

        return $loader->load('source', LocalizedRouteLoader::TYPE);
    }
}
