<?php

namespace App\User\Controller\Auth;

use App\Core\Controller\BaseController;
use App\Security\Attribute\GuestOnlyGrant;
use App\Security\Authenticator\UserAuthenticator;
use App\Security\Exception\TenantNotFoundAuthenticationException;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Shows the login form; UserAuthenticator handles its submission and redirects back here on failure.
 */
final class LoginController extends BaseController
{
    #[GuestOnlyGrant]
    #[Route('/{_locale}/login', name: 'user_auth_login', requirements: ['_locale' => '%app.locales%'], methods: ['GET', 'POST'])]
    public function __invoke(Request $request): Response
    {
        $utils = $this->auth()->utils;
        $error = $utils->getLastAuthenticationError();

        return $this->render('page/user/auth/login.html.twig', [
            'lastTenant' => $request->getSession()->get(UserAuthenticator::LAST_TENANT, ''),
            'lastUsername' => $utils->getLastUsername(),
            'error' => $error,
            'tenantError' => $error instanceof TenantNotFoundAuthenticationException,
        ]);
    }
}
