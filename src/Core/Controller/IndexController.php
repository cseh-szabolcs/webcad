<?php

namespace App\Core\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Home page. Pages carry the locale in the URL (/{_locale}/…); the bare root picks it from the browser.
 */
final class IndexController extends AbstractController
{
    /**
     * @param list<string> $enabledLocales
     */
    #[Route('/', name: 'app_root', methods: ['GET'])]
    public function root(Request $request, #[Autowire(param: 'kernel.enabled_locales')] array $enabledLocales): Response
    {
        return $this->redirectToRoute('app_index', ['_locale' => $request->getPreferredLanguage($enabledLocales)]);
    }

    #[Route('/{_locale}', name: 'app_index', requirements: ['_locale' => '%app.locales%'], methods: ['GET'])]
    public function index(): Response
    {
        return $this->render('index/index.html.twig');
    }
}
