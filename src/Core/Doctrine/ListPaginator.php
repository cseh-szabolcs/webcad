<?php

namespace App\Core\Doctrine;

use App\Core\Dto\ListResultDto;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use Doctrine\ORM\Tools\Pagination\OffsetPaginator;
use Doctrine\ORM\Tools\Pagination\Window;

/**
 * One page of a list from the database as ListResultDto: the database counts all rows and loads
 * only the rows of the page (Doctrine's OffsetPaginator), unlike ListResultDto::fromItems(),
 * which needs the whole list in memory.
 *
 * The caller builds the query with its conditions and its ORDER BY (sort columns only from a
 * fixed list, never straight from the request) and maps each entity to its DTO, as query results
 * never contain entities:
 *
 *     $builder = $this->createQueryBuilder('p')->orderBy('p.name', 'ASC')->addOrderBy('p.id');
 *
 *     return ListPaginator::paginate($builder, $page, $pageSize, ProjectDto::fromEntity(...));
 *
 * Order by a unique column last (e.g. the id), otherwise rows with equal sort values may show up
 * on two pages or on none. Costs a fixed number of queries: the page and the count (one more for
 * the page when the query fetch-joins a collection, `$fetchJoinCollection`), and the same again
 * for a page beyond the last one, which becomes the last one as in ListResultDto::fromItems().
 */
final class ListPaginator
{
    /**
     * @template E of object
     * @template D of object
     *
     * @param callable(E): D $map entity (or row) → DTO
     *
     * @return ListResultDto<D>
     */
    public static function paginate(
        QueryBuilder|Query $query,
        int $page,
        int $pageSize,
        callable $map,
        bool $fetchJoinCollection = true,
    ): ListResultDto {
        $paginator = new OffsetPaginator($fetchJoinCollection);
        $page = max(1, $page);
        $result = $paginator->paginate($query, Window::fromPageNumberAndSize($page, $pageSize));

        // The count comes with the page, so only now is it known whether the page exists.
        $lastPage = ListResultDto::pageCount($result->getTotalCount(), $pageSize);
        if ($page > $lastPage) {
            $page = $lastPage;
            $result = $paginator->paginate($query, Window::fromPageNumberAndSize($page, $pageSize));
        }

        return new ListResultDto(
            items: array_map($map, $result->getItems()),
            page: $page,
            pageSize: $pageSize,
            total: $result->getTotalCount(),
        );
    }
}
