<?php

namespace App\User\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Shows the login form. Its fields (_username, _password, _remember_me, _csrf_token "authenticate")
 * are the ones the firewall's form_login reads once users exist; until then a submission only says
 * that login is not available yet.
 */
final class LoginController extends AbstractController
{
    #[Route('/{_locale}/login', name: 'user_login', requirements: ['_locale' => '%app.locales%'], methods: ['GET', 'POST'])]
    public function __invoke(Request $request): Response
    {
        if ($request->isMethod('POST')) {
            $this->addFlash('notice', 'user.login.not_available');

            return $this->redirectToRoute('user_login');
        }

        return $this->render('user/login.html.twig');
    }
}
