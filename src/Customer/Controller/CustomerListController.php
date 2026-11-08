<?php

namespace App\Customer\Controller;

use App\Core\Controller\BaseController;
use App\Core\Dto\ListResultDto;
use App\Customer\Dto\CustomerListItemDto;
use App\Customer\Query\Customer\GetCustomerListQuery;
use App\Customer\Query\Customer\GetCustomerQuery;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapQueryString;
use Symfony\Component\Messenger\HandleTrait;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Requirement\Requirement;
use Symfony\Component\Uid\Uuid;

/**
 * The customer list: the page is static markup with dummy rows for now; `data` returns the items
 * for the JavaScript that will load them.
 */
#[Route('customers', name: 'customer_list_')]
final class CustomerListController extends BaseController
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
        return $this->render('page/customer/list.html.twig');
    }

    #[Route(path: '/data', name: 'data', methods: ['GET'])]
    public function data(#[MapQueryString] GetCustomerListQuery $query = new GetCustomerListQuery()): JsonResponse
    {
        /** @var ListResultDto $result */
        $result = $this->handle($query);

        return $this->json($result);
    }

    /** A selected customer that is not on the current page of the list, e.g. after a reload. */
    #[Route(path: '/data/{id}', name: 'detail', requirements: ['id' => Requirement::UUID], methods: ['GET'])]
    public function detail(Uuid $id): JsonResponse
    {
        /** @var CustomerListItemDto|null $customer */
        $customer = $this->handle(new GetCustomerQuery($id));

        if (null === $customer) {
            throw $this->createNotFoundException();
        }

        return $this->json($customer);
    }
}
