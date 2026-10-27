<?php

namespace App\Tests\Infrastructure\Tenancy;

use Doctrine\Persistence\ManagerRegistry;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Finder\Finder;

/**
 * Every entity belongs to the entity manager of its folder, or it would be written to the wrong
 * database: src/Domain/Entity to the tenant's, src/Domain/Main/Entity to app_main.
 */
final class EntityMappingTest extends KernelTestCase
{
    #[DataProvider('entityFolders')]
    public function testEntitiesAreManagedByTheirEntityManager(string $folder, string $namespace, string $entityManager): void
    {
        $registry = static::getContainer()->get(ManagerRegistry::class);
        $expected = $registry->getManager($entityManager);

        $classes = [];
        foreach ((new Finder())->files()->in(\dirname(__DIR__, 3).'/'.$folder)->name('*.php') as $file) {
            $classes[] = $namespace.'\\'.str_replace('/', '\\', substr($file->getRelativePathname(), 0, -4));
        }

        self::assertNotEmpty($classes);
        foreach ($classes as $class) {
            self::assertSame($expected, $registry->getManagerForClass($class), $class);
        }
    }

    /**
     * @return iterable<string, array{string, string, string}>
     */
    public static function entityFolders(): iterable
    {
        yield 'tenant' => ['src/Domain/Entity', 'App\Domain\Entity', 'tenant'];
        yield 'main' => ['src/Domain/Main/Entity', 'App\Domain\Main\Entity', 'main'];
    }
}
