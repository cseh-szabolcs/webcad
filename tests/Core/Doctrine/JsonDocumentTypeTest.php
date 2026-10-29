<?php

namespace App\Tests\Core\Doctrine;

use App\Core\Doctrine\JsonDocumentType;
use App\Tests\Core\Doctrine\Fixtures\CircleShape;
use App\Tests\Core\Doctrine\Fixtures\Point;
use App\Tests\Core\Doctrine\Fixtures\SegmentShape;
use Doctrine\DBAL\Platforms\MySQL80Platform;
use Doctrine\DBAL\Types\Exception\InvalidType;
use Doctrine\DBAL\Types\Exception\ValueNotConvertible;
use Doctrine\DBAL\Types\Type;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

final class JsonDocumentTypeTest extends KernelTestCase
{
    /**
     * @return iterable<string, array{object, string}>
     */
    public static function documents(): iterable
    {
        yield 'plain object' => [new Point(1.5, -2.0), '{"#type":"App\\\\Tests\\\\Core\\\\Doctrine\\\\Fixtures\\\\Point","x":1.5,"y":-2.0}'];

        // A member of a union also carries the "type" of its discriminator map
        yield 'union member' => [
            new CircleShape(600.0, true),
            '{"#type":"App\\\\Tests\\\\Core\\\\Doctrine\\\\Fixtures\\\\CircleShape","type":"circle","radius":600.0,"filled":true}',
        ];
        yield 'union member with a default' => [
            new CircleShape(600.0),
            '{"#type":"App\\\\Tests\\\\Core\\\\Doctrine\\\\Fixtures\\\\CircleShape","type":"circle","radius":600.0,"filled":false}',
        ];
        yield 'union member with nested objects' => [
            new SegmentShape(new Point(500.0, -200.0), new Point(-500.0, -200.0)),
            '{"#type":"App\\\\Tests\\\\Core\\\\Doctrine\\\\Fixtures\\\\SegmentShape","type":"segment","start":{"x":500.0,"y":-200.0},"end":{"x":-500.0,"y":-200.0}}',
        ];
    }

    #[DataProvider('documents')]
    public function testObjectRoundTripsWithItsClassName(object $document, string $json): void
    {
        $platform = new MySQL80Platform();

        $stored = $this->type()->convertToDatabaseValue($document, $platform);

        self::assertJsonStringEqualsJsonString($json, $stored);
        $read = $this->type()->convertToPHPValue($stored, $platform);
        self::assertInstanceOf($document::class, $read);
        self::assertEquals($document, $read);
    }

    public function testNullStaysNull(): void
    {
        self::assertNull($this->type()->convertToDatabaseValue(null, new MySQL80Platform()));
        self::assertNull($this->type()->convertToPHPValue(null, new MySQL80Platform()));
    }

    public function testDocumentWithoutClassIsNotConvertible(): void
    {
        $this->expectException(ValueNotConvertible::class);

        $this->type()->convertToPHPValue('{"type":"circle","radius":600.0}', new MySQL80Platform());
    }

    public function testUnknownClassIsNotConvertible(): void
    {
        $this->expectException(ValueNotConvertible::class);

        $this->type()->convertToPHPValue('{"#type":"App\\\\Tests\\\\Core\\\\Doctrine\\\\Fixtures\\\\SquareShape"}', new MySQL80Platform());
    }

    public function testOnlyObjectsAreStored(): void
    {
        $this->expectException(InvalidType::class);

        $this->type()->convertToDatabaseValue(['type' => 'line'], new MySQL80Platform());
    }

    private function type(): Type
    {
        // Registered by Kernel::boot()
        self::bootKernel();

        return Type::getType(JsonDocumentType::NAME);
    }
}
