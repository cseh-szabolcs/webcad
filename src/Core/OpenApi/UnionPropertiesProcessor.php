<?php

namespace App\Core\OpenApi;

use OpenApi\Analysis;
use OpenApi\Annotations as OA;
use OpenApi\Undefined;

/**
 * A union interface declares the properties all its branches share (`ElementInterface`), and
 * NelmioApiDoc publishes them next to the `oneOf`. Each branch documents them already, with their
 * prose and formats, so the union keeps only `oneOf` and the discriminator.
 */
final readonly class UnionPropertiesProcessor
{
    public function __construct(
        private AnnotationTraverser $traverser,
    ) {
    }

    public function __invoke(Analysis $analysis): void
    {
        if (!$analysis->openapi instanceof OA\OpenApi) {
            return;
        }

        $this->traverser->walk($analysis->openapi, static function (OA\AbstractAnnotation $annotation): void {
            if ($annotation instanceof OA\Schema && $annotation->discriminator instanceof OA\Discriminator && \is_array($annotation->oneOf)) {
                $annotation->properties = Undefined::UNDEFINED;
                $annotation->required = Undefined::UNDEFINED;
            }
        });
    }
}
