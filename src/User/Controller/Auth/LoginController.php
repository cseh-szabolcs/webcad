<?php

namespace App\User\Controller\Auth;

use App\Core\Controller\BaseController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

final class LoginController extends BaseController
{
    #[Route('/{_locale}/login', name: 'user_auth_login', requirements: ['_locale' => '%app.locales%'], methods: ['GET', 'POST'])]
    public function __invoke(Request $request): Response
    {
        $utils = $this->auth()->utils;

        return $this->render('page/user/auth/login.html.twig', [
            'lastUsername' => $utils->getLastUsername(),
            'error' => $utils->getLastAuthenticationError(),
        ]);
    }
}
