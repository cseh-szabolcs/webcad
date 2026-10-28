<?php

namespace App\OpenApi;

use Nelmio\ApiDocBundle\OpenApiPhp\Util;
use OpenApi\Analysis;
use OpenApi\Annotations as OA;
use OpenApi\Undefined;

/**
 * The doc UI resolves a `$ref` before rendering, so a schema title is what survives to name a
 * branch. The discriminating property is no model's, so it is pinned here as a one-value enum,
 * which openapi-typescript turns into a literal type.
 */
final readonly class DiscriminatorBranchProcessor
{
    public function __construct(
        private AnnotationTraverser $traverser,
    ) {
    }

    public function __invoke(Analysis $analysis): void
    {
        $openApi = $analysis->openapi;

        if (!$openApi instanceof OA\OpenApi
            || !$openApi->components instanceof OA\Components
            || !\is_array($openApi->components->schemas)
        ) {
            return;
        }

        $schemas = $this->byName($openApi->components->schemas);

        foreach ($this->collectTags($openApi) as $name => $tag) {
            if (!isset($schemas[$name])) {
                continue;
            }

            $this->describe($schemas[$name], $name, $tag['property'], $tag['value']);
        }
    }

    /**
     * @param array<OA\Schema> $schemas
     *
     * @return array<string, OA\Schema>
     */
    private function byName(array $schemas): array
    {
        $byName = [];
        foreach ($schemas as $schema) {
            if (\is_string($schema->schema) && !Undefined::isDefault($schema->schema)) {
                $byName[$schema->schema] = $schema;
            }
        }

        return $byName;
    }

    /**
     * @return array<string, array{property: string, value: string}> schema name => its discriminator
     */
    private function collectTags(OA\OpenApi $openApi): array
    {
        $tags = [];
        $conflicting = [];

        $this->traverser->walk($openApi, static function (OA\AbstractAnnotation $annotation) use (&$tags, &$conflicting): void {
            if (!$annotation instanceof OA\Discriminator
                || !\is_string($annotation->propertyName)
                || Undefined::isDefault($annotation->propertyName)
                || !\is_array($annotation->mapping)
            ) {
                return;
            }

            foreach ($annotation->mapping as $value => $ref) {
                if (!\is_string($ref) || !str_starts_with($ref, OA\Components::SCHEMA_REF)) {
                    continue;
                }

                $name = mb_substr($ref, mb_strlen(OA\Components::SCHEMA_REF));
                $tag = ['property' => $annotation->propertyName, 'value' => (string) $value];

                if (isset($tags[$name]) && $tags[$name] !== $tag) {
                    $conflicting[$name] = true;
                }

                $tags[$name] = $tag;
            }
        });

        return array_diff_key($tags, $conflicting);
    }

    private function describe(OA\Schema $schema, string $name, string $property, string $value): void
    {
        if (Undefined::isDefault($schema->title)) {
            $schema->title = $name;
        }

        $properties = \is_array($schema->properties) ? $schema->properties : [];

        foreach ($properties as $existing) {
            if ($existing->property === $property) {
                return;
            }
        }

        $schema->properties = [
            new OA\Property([
                'property' => $property,
                'type' => 'string',
                'enum' => [$value],
                'description' => 'Names this variant of the union.',
                '_context' => Util::createWeakContext($schema->_context),
            ]),
            ...$properties,
        ];

        $required = \is_array($schema->required) ? $schema->required : [];
        $schema->required = [$property, ...$required];
    }
}
