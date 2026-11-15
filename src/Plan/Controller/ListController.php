<?php

namespace App\Plan\Controller;

use App\Core\Controller\BaseController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * The plan gallery: static markup with three dummy plans for now; their links lead to the editor later.
 */
#[Route('plans', name: 'plan_list_')]
final class ListController extends BaseController
{
    #[Route(name: 'index', methods: ['GET'])]
    public function index(): Response
    {
        return $this->render('page/plan/list.html.twig');
    }
}
