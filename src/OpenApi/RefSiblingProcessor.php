<?php

namespace App\OpenApi;

use Nelmio\ApiDocBundle\OpenApiPhp\Util;
use OpenApi\Analysis;
use OpenApi\Annotations as OA;
use OpenApi\Undefined;

/**
 * OpenAPI 3.0 forbids anything next to a `$ref`, so swagger-php drops the description an
 * `#[OA\Property]` put there. Wrapping the ref in an allOf is the documented way around it.
 */
final readonly class RefSiblingProcessor
{
    private const array SIBLINGS = ['title', 'description', 'x'];

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
            if (!$annotation instanceof OA\Schema
                || Undefined::isDefault($annotation->ref)
                || !\is_string($annotation->ref)
                || !Undefined::isDefault($annotation->allOf)
            ) {
                return;
            }

            foreach (self::SIBLINGS as $sibling) {
                if (Undefined::isDefault($annotation->{$sibling})) {
                    continue;
                }

                $annotation->allOf = [new OA\Schema([
                    'ref' => $annotation->ref,
                    '_context' => Util::createWeakContext($annotation->_context),
                ])];
                $annotation->ref = Undefined::UNDEFINED;

                return;
            }
        });
    }
}
