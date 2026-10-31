<?php

namespace App\Core\Component\Reader;

use App\Core\Traits\Pattern\StaticTrait;

final readonly class AttributeReader
{
    use StaticTrait;

    /**
     * @template T of object
     *
     * @param class-string<T> $attributeName
     *
     * @return T[]
     *
     * @throws \ReflectionException
     */
    public static function fromMethod(object|string $object, string $method, string $attributeName, bool $fallbackToClass = false): array
    {
        $isInterface = str_ends_with($attributeName, 'Interface');
        $refMethod = new \ReflectionMethod($object, $method);
        $result = $refMethod->getAttributes($isInterface ? null : $attributeName) ?? [];

        if (empty($result)) {
            return $fallbackToClass
                ? self::fromClass($object, $attributeName)
                : [];
        }

        return self::map($result, $isInterface ? $attributeName : null);
    }

    /**
     * @template T of object
     *
     * @param class-string<T> $attributeName
     *
     * @return T[]
     *
     * @throws \ReflectionException
     */
    public static function fromClass(object|string $object, string $attributeName, bool $parent = false): array
    {
        $isInterface = str_ends_with($attributeName, 'Interface');
        $refClass = new \ReflectionClass($object);
        $result = $refClass->getAttributes($isInterface ? null : $attributeName) ?? [];

        if (empty($result)) {
            return $parent
                ? self::iterateParent($refClass, $attributeName, $isInterface)
                : [];
        }

        return self::map($result, $isInterface ? $attributeName : null);
    }

    private static function iterateParent(\ReflectionClass $refClass, string $attributeName, bool $isInterface = false): array
    {
        while ($refClass) {
            $result = $refClass->getAttributes($isInterface ? null : $attributeName) ?? [];
            if (count($result)) {
                return self::map($result, $isInterface ? $attributeName : null);
            }
            $refClass = $refClass->getParentClass();
        }

        return [];
    }

    private static function map(array $attributes, ?string $interfaceName = null): array
    {
        if ($interfaceName) {
            $attributes = array_filter(
                $attributes,
                fn (\ReflectionAttribute $attribute) => is_a($attribute->getName(), $interfaceName, true),
            );
        }

        return array_map(static fn (\ReflectionAttribute $attr): object => $attr->newInstance(), $attributes);
    }
}
