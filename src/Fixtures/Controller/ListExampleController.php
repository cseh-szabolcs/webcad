<?php

namespace App\Fixtures\Controller;

use App\Core\Controller\BaseController;
use App\Fixtures\Dto\ListExampleItemDto;
use App\Fixtures\Dto\ListExamplePageDto;
use App\Fixtures\Dto\ListExampleQueryDto;
use App\Security\Attribute\AuthGrant;
use App\Security\Attribute\EnvironmentGrant;
use App\Security\Attribute\XhrGrant;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapQueryString;
use Symfony\Component\Routing\Attribute\Route;

#[Route('fixtures/list-example', name: 'fixtures_list_example_')]
class ListExampleController extends BaseController
{
    /** Number of items of the example, so the list has several pages. */
    private const int ITEM_COUNT = 23;

    #[EnvironmentGrant]
    #[AuthGrant]
    #[Route(path: '/page', name: 'page', methods: ['GET'])]
    public function page(): Response
    {
        return $this->render('page/fixtures/list-example.html.twig');
    }

    #[EnvironmentGrant]
    #[AuthGrant]
    #[XhrGrant]
    #[Route(path: '/data', name: 'data', methods: ['GET'])]
    public function data(#[MapQueryString] ListExampleQueryDto $query = new ListExampleQueryDto()): JsonResponse
    {
        sleep(2);

        // `value` in a different order than `number`, so sorting by it shows.
        $items = array_map(
            static fn (int $number): ListExampleItemDto => new ListExampleItemDto($number, ($number * 37) % self::ITEM_COUNT),
            range(1, self::ITEM_COUNT),
        );

        if (null !== $query->sort) {
            $sign = 'desc' === $query->direction ? -1 : 1;
            usort($items, static fn (ListExampleItemDto $a, ListExampleItemDto $b): int => $sign * ($a->{$query->sort} <=> $b->{$query->sort}));
        }

        $pageCount = max(1, (int) ceil(count($items) / $query->pageSize));
        $page = min($query->page, $pageCount);

        return $this->json(new ListExamplePageDto(
            items: array_slice($items, ($page - 1) * $query->pageSize, $query->pageSize),
            total: count($items),
            page: $page,
            pageSize: $query->pageSize,
        ));
    }
}
