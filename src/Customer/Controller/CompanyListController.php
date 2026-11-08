<?php

namespace App\Customer\Controller;

use App\Core\Controller\BaseController;
use App\Core\Dto\ListResultDto;
use App\Customer\Query\GetCompanyListQuery;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapQueryString;
use Symfony\Component\Messenger\HandleTrait;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Attribute\Route;

/**
 * The company list: the page is static markup with dummy rows for now; `data` returns the items
 * for the JavaScript that will load them.
 */
#[Route('customers/companies', name: 'customer_company_list_')]
final class CompanyListController extends BaseController
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
        return $this->render('page/customer/company/list.html.twig');
    }

    #[Route(path: '/data', name: 'data', methods: ['GET'])]
    public function data(#[MapQueryString] GetCompanyListQuery $query = new GetCompanyListQuery()): JsonResponse
    {
        /** @var ListResultDto $result */
        $result = $this->handle($query);

        return $this->json($result);
    }
}
