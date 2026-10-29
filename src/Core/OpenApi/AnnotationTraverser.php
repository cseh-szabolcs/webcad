<?php

namespace App\Core\OpenApi;

use OpenApi\Annotations as OA;

/**
 * swagger-php only exposes the annotations that existed when the Analysis was built, while
 * NelmioApiDoc keeps adding schemas afterwards, so a processor has to walk the document itself.
 */
final class AnnotationTraverser
{
    /**
     * @param callable(OA\AbstractAnnotation): void $visitor
     */
    public function walk(OA\AbstractAnnotation $root, callable $visitor): void
    {
        /** @var \SplObjectStorage<OA\AbstractAnnotation, null> $visited */
        $visited = new \SplObjectStorage();

        $this->visit($root, $visitor, $visited);
    }

    /**
     * @param callable(OA\AbstractAnnotation): void          $visitor
     * @param \SplObjectStorage<OA\AbstractAnnotation, null> $visited
     */
    private function visit(OA\AbstractAnnotation $annotation, callable $visitor, \SplObjectStorage $visited): void
    {
        if ($visited->offsetExists($annotation)) {
            return;
        }
        $visited->offsetSet($annotation);

        $visitor($annotation);

        foreach (get_object_vars($annotation) as $property => $value) {
            if ('_context' === $property) {
                continue;
            }

            $this->visitValue($value, $visitor, $visited);
        }
    }

    /**
     * @param callable(OA\AbstractAnnotation): void          $visitor
     * @param \SplObjectStorage<OA\AbstractAnnotation, null> $visited
     */
    private function visitValue(mixed $value, callable $visitor, \SplObjectStorage $visited): void
    {
        if ($value instanceof OA\AbstractAnnotation) {
            $this->visit($value, $visitor, $visited);

            return;
        }

        if (\is_array($value)) {
            foreach ($value as $item) {
                $this->visitValue($item, $visitor, $visited);
            }
        }
    }
}
