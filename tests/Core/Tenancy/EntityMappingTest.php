<?php

namespace App\Tests\Core\Tenancy;

use Doctrine\ORM\Mapping\Embeddable;
use Doctrine\Persistence\ManagerRegistry;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Finder\Finder;

/**
 * Every entity belongs to the entity manager of its folder, or it would be written to the wrong
 * database: src/Plan/Entity and src/Project/Entity to the tenant's, src/Core/Tenancy/Entity to app_main.
 * An embeddable (e.g. Vector2) belongs to no manager of its own, so for it the folder's manager
 * must map it as one.
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
            if ([] !== (new \ReflectionClass($class))->getAttributes(Embeddable::class)) {
                self::assertTrue($expected->getClassMetadata($class)->isEmbeddedClass, $class);
            } else {
                self::assertSame($expected, $registry->getManagerForClass($class), $class);
            }
        }
    }

    /**
     * @return iterable<string, array{string, string, string}>
     */
    public static function entityFolders(): iterable
    {
        yield 'plan' => ['src/Plan/Entity', 'App\Plan\Entity', 'tenant'];
        yield 'project' => ['src/Project/Entity', 'App\Project\Entity', 'tenant'];
        yield 'main' => ['src/Core/Tenancy/Entity', 'App\Core\Tenancy\Entity', 'main'];
    }
}
