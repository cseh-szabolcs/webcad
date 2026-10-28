<?php

namespace App\OpenApi;

use OpenApi\Analysis;
use OpenApi\Annotations as OA;
use OpenApi\Undefined;

/**
 * NelmioApiDoc reads defaults off the constructor, so `public Uuid $id = new UuidV7()` would make
 * the document differ on every request. Backed enums are kept: they serialise to a stable value.
 */
final readonly class GeneratedDefaultProcessor
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
            if ($annotation instanceof OA\Schema && \is_object($annotation->default) && !$annotation->default instanceof \BackedEnum) {
                $annotation->default = Undefined::UNDEFINED;
            }
        });
    }
}
