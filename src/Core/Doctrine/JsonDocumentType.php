<?php

namespace App\Core\Doctrine;

use Doctrine\DBAL\Platforms\AbstractPlatform;
use Doctrine\DBAL\Types\Exception\InvalidType;
use Doctrine\DBAL\Types\Exception\ValueNotConvertible;
use Doctrine\DBAL\Types\JsonType;
use Symfony\Component\Serializer\Exception\ExceptionInterface as SerializerException;
use Symfony\Component\Serializer\Normalizer\DenormalizerInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;

/**
 * Stores an object as a JSON document and reads it back into its class: the serializer writes
 * the object's properties, and "#type" names its class, as a Doctrine type does not know the
 * property it converts. Moving or renaming such a class therefore needs a data migration.
 *
 * Needs the application's serializer, so it is registered as an instance by
 * JsonDocumentTypeRegistrar rather than by class in doctrine.yaml.
 */
final class JsonDocumentType extends JsonType
{
    public const string NAME = 'json_document';

    /** Holds the class name; "#" keeps it apart from the object's own properties. */
    public const string TYPE_KEY = '#type';

    public function __construct(
        private readonly NormalizerInterface $normalizer,
        private readonly DenormalizerInterface $denormalizer,
    ) {
    }

    public function convertToDatabaseValue(mixed $value, AbstractPlatform $platform): ?string
    {
        if (null === $value) {
            return null;
        }
        if (!\is_object($value)) {
            throw InvalidType::new($value, self::NAME, ['null', 'object']);
        }

        $data = $this->normalizer->normalize($value);

        return parent::convertToDatabaseValue([self::TYPE_KEY => $value::class, ...$data], $platform);
    }

    public function convertToPHPValue(mixed $value, AbstractPlatform $platform): ?object
    {
        $data = parent::convertToPHPValue($value, $platform);
        if (null === $data) {
            return null;
        }

        $class = $data[self::TYPE_KEY] ?? null;
        if (!\is_string($class) || !class_exists($class)) {
            throw ValueNotConvertible::new($value, self::NAME, \sprintf('"%s" names no class.', self::TYPE_KEY));
        }
        unset($data[self::TYPE_KEY]);

        try {
            return $this->denormalizer->denormalize($data, $class);
        } catch (SerializerException $e) {
            throw ValueNotConvertible::new($value, self::NAME, $e->getMessage(), $e);
        }
    }
}
