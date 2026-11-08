<?php

namespace App\Core\Doctrine;

use Doctrine\ORM\QueryBuilder;

/**
 * A search in a list query: every word of `$search` must be found in one of `$fields` (DQL paths
 * like `c.name`). % and _ are ordinary characters; LIKE follows the column's collation.
 */
final class WordSearch
{
    /** @param non-empty-list<string> $fields */
    public static function apply(QueryBuilder $builder, string $search, array $fields): void
    {
        foreach (preg_split('/\s+/', $search, flags: \PREG_SPLIT_NO_EMPTY) as $index => $word) {
            $parameter = 'word'.$index;
            $builder
                ->andWhere(implode(' OR ', array_map(
                    static fn (string $field): string => \sprintf('%s LIKE :%s', $field, $parameter),
                    $fields,
                )))
                ->setParameter($parameter, '%'.addcslashes($word, '%_\\').'%');
        }
    }
}
