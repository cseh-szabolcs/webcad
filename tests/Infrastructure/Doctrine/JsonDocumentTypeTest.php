<?php

namespace App\Tests\Infrastructure\Doctrine;

use App\Domain\ElementProps\ArcProps;
use App\Domain\ElementProps\BezierProps;
use App\Domain\ElementProps\CircleProps;
use App\Domain\ElementProps\EllipseProps;
use App\Domain\ElementProps\LineProps;
use App\Domain\ElementProps\PolylineProps;
use App\Domain\ElementProps\Vector2;
use App\Infrastructure\Doctrine\JsonDocumentType;
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
        // Any object, not only element props
        yield 'plain object' => [new Vector2(1.5, -2.0), '{"#type":"App\\\\Domain\\\\ElementProps\\\\Vector2","x":1.5,"y":-2.0}'];

        // Element props also carry the "type" of their discriminator map
        yield 'line' => [new LineProps(), '{"#type":"App\\\\Domain\\\\ElementProps\\\\LineProps","type":"line"}'];
        yield 'polyline' => [new PolylineProps(true), '{"#type":"App\\\\Domain\\\\ElementProps\\\\PolylineProps","type":"polyline","closed":true}'];
        yield 'arc' => [new ArcProps(false), '{"#type":"App\\\\Domain\\\\ElementProps\\\\ArcProps","type":"arc","clockwise":false}'];
        yield 'circle' => [new CircleProps(600.0), '{"#type":"App\\\\Domain\\\\ElementProps\\\\CircleProps","type":"circle","radius":600.0}'];
        yield 'ellipse' => [
            new EllipseProps(1000.0, 700.0, 0.25),
            '{"#type":"App\\\\Domain\\\\ElementProps\\\\EllipseProps","type":"ellipse","radiusX":1000.0,"radiusY":700.0,"rotation":0.25}',
        ];
        yield 'bezier' => [
            new BezierProps(new Vector2(500.0, -200.0), new Vector2(-500.0, -200.0)),
            '{"#type":"App\\\\Domain\\\\ElementProps\\\\BezierProps","type":"bezier","startControl":{"x":500.0,"y":-200.0},"endControl":{"x":-500.0,"y":-200.0}}',
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

        $this->type()->convertToPHPValue('{"#type":"App\\\\Domain\\\\ElementProps\\\\SplineProps"}', new MySQL80Platform());
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
