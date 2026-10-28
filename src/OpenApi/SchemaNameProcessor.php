<?php

namespace App\OpenApi;

use OpenApi\Analysis;
use OpenApi\Annotations as OA;
use OpenApi\Undefined;

/**
 * Runs as a swagger-php processor, i.e. after the whole model graph has been registered, so
 * `ElementInterface` is documented as "Element" and every `$ref` at it is rewritten.
 */
final readonly class SchemaNameProcessor
{
    private const string INTERFACE_SUFFIX = 'Interface';

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

        $renames = $this->collectRenames($openApi->components->schemas);

        if ([] === $renames) {
            return;
        }

        $this->traverser->walk($openApi, function (OA\AbstractAnnotation $annotation) use ($renames): void {
            $this->rewriteAnnotation($annotation, $renames);
        });
    }

    /**
     * @param array<OA\Schema> $schemas
     *
     * @return array<string, string> old schema name => new schema name
     */
    private function collectRenames(array $schemas): array
    {
        $taken = [];
        foreach ($schemas as $schema) {
            if (null !== $name = $this->schemaName($schema)) {
                $taken[$name] = true;
            }
        }

        $renames = [];
        foreach ($schemas as $schema) {
            if (null === $current = $this->schemaName($schema)) {
                continue;
            }

            $new = $this->resolveName($schema, $current);

            // Never silently merge two schemas into one name.
            if (null === $new || isset($taken[$new])) {
                continue;
            }

            $renames[$current] = $new;
            unset($taken[$current]);
            $taken[$new] = true;
        }

        return $renames;
    }

    private function schemaName(OA\Schema $schema): ?string
    {
        return \is_string($schema->schema) && !Undefined::isDefault($schema->schema) ? $schema->schema : null;
    }

    private function resolveName(OA\Schema $schema, string $current): ?string
    {
        $name = $this->withoutInterfaceSuffix($schema, $current);

        return '' !== $name && $name !== $current ? $name : null;
    }

    /**
     * Only an interface loses the suffix: a class that happens to end in "Interface" is named
     * what it is called.
     */
    private function withoutInterfaceSuffix(OA\Schema $schema, string $current): string
    {
        $class = get_object_vars($schema->_context)['class'] ?? null;

        if (!\is_string($class) || !interface_exists($class) || !str_ends_with($current, self::INTERFACE_SUFFIX)) {
            return $current;
        }

        return mb_substr($current, 0, -mb_strlen(self::INTERFACE_SUFFIX));
    }

    /**
     * @param array<string, string> $renames
     */
    private function rewriteAnnotation(OA\AbstractAnnotation $annotation, array $renames): void
    {
        if ($annotation instanceof OA\Schema && null !== $name = $this->schemaName($annotation)) {
            $annotation->schema = $renames[$name] ?? $name;
        }

        if (property_exists($annotation, 'ref') && \is_string($annotation->ref)) {
            $annotation->ref = $this->rewriteRef($annotation->ref, $renames);
        }

        if ($annotation instanceof OA\Discriminator && \is_array($annotation->mapping)) {
            foreach ($annotation->mapping as $value => $ref) {
                if (\is_string($ref)) {
                    $annotation->mapping[$value] = $this->rewriteRef($ref, $renames);
                }
            }
        }
    }

    /**
     * @param array<string, string> $renames
     */
    private function rewriteRef(string $ref, array $renames): string
    {
        if (!str_starts_with($ref, OA\Components::SCHEMA_REF)) {
            return $ref;
        }

        $name = mb_substr($ref, mb_strlen(OA\Components::SCHEMA_REF));

        return isset($renames[$name]) ? OA\Components::SCHEMA_REF.$renames[$name] : $ref;
    }
}
