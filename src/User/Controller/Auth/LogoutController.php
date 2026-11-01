<?php

namespace App\User\Controller\Auth;

use Symfony\Component\Routing\Attribute\Route;

/**
 * The logout URL. The firewall handles it (logout in security.yaml) before this action is reached.
 */
final class LogoutController
{
    #[Route('/logout', name: 'user_auth_logout', methods: ['GET'])]
    public function __invoke(): never
    {
        throw new \LogicException('The firewall intercepts the logout.');
    }
}
