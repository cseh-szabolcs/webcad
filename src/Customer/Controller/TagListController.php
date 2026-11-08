<?php

namespace App\Customer\Controller;

use App\Core\Controller\BaseController;
use App\Core\Dto\ListResultDto;
use App\Customer\Query\GetTagListQuery;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapQueryString;
use Symfony\Component\Messenger\HandleTrait;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Attribute\Route;

/**
 * The tag list: the page is static markup with dummy rows for now; `data` returns the items
 * for the JavaScript that will load them.
 */
#[Route('customers/tags', name: 'customer_tag_list_')]
final class TagListController extends BaseController
{
    use HandleTrait;

    public function __construct(
        #[Autowire(service: 'query.bus')]
        MessageBusInterface $messageBus,
    ) {
        $this->messageBus = $messageBus;
    }

    #[Route(name: 'index', methods: ['GET'])]
    public function index(): Response
    {
        return $this->render('page/customer/tag/list.html.twig');
    }

    #[Route(path: '/data', name: 'data', methods: ['GET'])]
    public function data(#[MapQueryString] GetTagListQuery $query = new GetTagListQuery()): JsonResponse
    {
        /** @var ListResultDto $result */
        $result = $this->handle($query);

        return $this->json($result);
    }
}
