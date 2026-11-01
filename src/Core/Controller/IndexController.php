<?php

namespace App\Core\Controller;

use App\Core\Routing\Attribute\GlobalRoute;
use App\Security\AccessGrant\Attribute\GuestOnlyGrant;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Home page. Pages carry the locale in the URL (/{_locale}/…, LocalizedRouteLoader); the bare root picks it from the browser.
 * Logged-in users go to their start page (DashboardController) instead (GuestOnlyGrant).
 */
final class IndexController extends AbstractController
{
    /**
     * @param list<string> $enabledLocales
     */
    #[GuestOnlyGrant]
    #[GlobalRoute('/', name: 'app_root', methods: ['GET'])]
    public function root(Request $request, #[Autowire(param: 'kernel.enabled_locales')] array $enabledLocales): Response
    {
        return $this->redirectToRoute('app_index', ['_locale' => $request->getPreferredLanguage($enabledLocales)]);
    }

    #[GuestOnlyGrant]
    #[Route('/', name: 'app_index', methods: ['GET'])]
    public function index(): Response
    {
        return $this->render('page/core/index.html.twig');
    }
}
