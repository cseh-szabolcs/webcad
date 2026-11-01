<?php

namespace App\Core\Controller;

use App\Core\Tenancy\TenantSwitcher;
use App\Security\Attribute\AuthGrant;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Start page for logged-in users, a placeholder for now. Guests are sent to the login form
 * (the firewall's entry point) and come back here after logging in.
 */
final class DashboardController extends AbstractController
{
    #[AuthGrant]
    #[Route('/{_locale}/app', name: 'app_dashboard', requirements: ['_locale' => '%app.locales%'], methods: ['GET'])]
    public function __invoke(TenantSwitcher $tenantSwitcher): Response
    {
        return $this->render('page/core/dashboard.html.twig', [
            'tenant' => $tenantSwitcher->currentTenant(),
        ]);
    }
}
