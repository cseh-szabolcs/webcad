<?php

namespace App\Tests\Core\Entity;

use App\Core\Entity\BaseTag;
use App\Core\Tenancy\TenantSwitcher;
use App\Customer\Entity\Tag;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/** All tags live in one table; the discriminator gives them back as the subclass of their purpose. */
final class BaseTagTest extends KernelTestCase
{
    protected function setUp(): void
    {
        // Without a request or console command, nothing selects the tenant (see .env.test)
        static::getContainer()->get(TenantSwitcher::class)->switchTo($_ENV['DEFAULT_TENANT']);
    }

    public function testATagIsStoredWithItsPurposeAndLoadedAsItsSubclass(): void
    {
        $em = $this->em();
        $tag = new Tag('Bauherr');
        $em->persist($tag);
        $em->flush();
        $em->clear();

        $loaded = $em->find(BaseTag::class, $tag->getId());

        self::assertInstanceOf(Tag::class, $loaded);
        self::assertSame('Bauherr', $loaded->getName());
        self::assertSame($tag->getUuid()->toRfc4122(), $loaded->getUuid()->toRfc4122());
        self::assertSame('customer', $em->getConnection()->fetchOne('SELECT type FROM tag WHERE id = ?', [$tag->getId()]));
    }

    public function testAllPurposesShareOneTable(): void
    {
        $em = $this->em();

        self::assertSame('tag', $em->getClassMetadata(BaseTag::class)->getTableName());
        self::assertSame('tag', $em->getClassMetadata(Tag::class)->getTableName());
    }

    private function em(): EntityManagerInterface
    {
        return static::getContainer()->get(EntityManagerInterface::class);
    }
}
