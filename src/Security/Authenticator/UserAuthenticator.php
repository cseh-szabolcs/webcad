<?php

declare(strict_types=1);

namespace App\Security\Authenticator;

use App\Core\App;
use App\Core\Tenancy\Exception\TenantNotFoundException;
use App\Core\Tenancy\TenantStorage;
use App\Core\Tenancy\TenantSwitcher;
use App\Security\Exception\TenantNotFoundAuthenticationException;
use App\Security\Model\Credentials;
use App\Security\UserProvider;
use App\User\Entity\User;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Http\Authentication\UserAuthenticatorInterface;
use Symfony\Component\Security\Http\Authenticator\AbstractLoginFormAuthenticator;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\CsrfTokenBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\RememberMeBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Credentials\PasswordCredentials;
use Symfony\Component\Security\Http\Authenticator\Passport\Passport;
use Symfony\Component\Security\Http\SecurityRequestAttributes;
use Symfony\Component\Security\Http\Util\TargetPathTrait;

/**
 * The login form: selects the tenant named in the form first, because the user lives in the
 * tenant's database, then checks the user's password there. A successful login stores the tenant
 * for the following requests (TenantStorage).
 */
class UserAuthenticator extends AbstractLoginFormAuthenticator
{
    use TargetPathTrait;

    /** Session key of the tenant name last entered, to fill the form again after a failure */
    public const string LAST_TENANT = '_security.last_tenant';

    public function __construct(
        private readonly TenantSwitcher $tenantSwitcher,
        private readonly TenantStorage $tenantStorage,
        private readonly UserProvider $userProvider,
        private readonly UserAuthenticatorInterface $userAuthenticator,
        private readonly App $app,
    ) {
    }

    public function supports(Request $request): bool
    {
        return $request->isMethod('POST')
            && $this->getLoginUrl($request) === $this->app->getCurrentPath();
    }

    public function authenticate(Request $request): Passport
    {
        $badges = [new RememberMeBadge()];

        $credentials = $this->createCredentials($badges, $request);

        $session = $request->getSession();
        $session->set(self::LAST_TENANT, $credentials->tenantName);
        $session->set(SecurityRequestAttributes::LAST_USERNAME, $credentials->identifier);

        try {
            $this->tenantSwitcher->switchTo($credentials->tenantName);
        } catch (TenantNotFoundException) {
            throw new TenantNotFoundAuthenticationException();
        }

        return new Passport(
            new UserBadge($credentials->identifier, $this->userProvider->loadUserByIdentifier(...)),
            new PasswordCredentials($credentials->password),
            $badges,
        );
    }

    public function login(User $user): ?Response
    {
        return $this->userAuthenticator->authenticateUser($user, $this, $this->app->getMainRequest());
    }

    public function onAuthenticationSuccess(Request $request, TokenInterface $token, string $firewallName): ?Response
    {
        // todo: create the auth token (TokenVerifier::create) once tokens are implemented

        $session = $request->getSession();
        $targetPath = $this->getTargetPath($session, $firewallName)
            ?? $this->app->urlGenerator->generate('app_dashboard');
        $this->removeTargetPath($session, $firewallName);
        $session->remove(self::LAST_TENANT);

        $response = new RedirectResponse($targetPath);
        $this->tenantStorage->store($request, $response, $this->tenantSwitcher->currentTenant());

        return $response;
    }

    protected function getLoginUrl(Request $request): string
    {
        return $this->app->urlGenerator->generate('user_auth_login');
    }

    private function createCredentials(array &$badges, Request $request): Credentials
    {
        $payload = $request->getPayload();

        array_unshift($badges, new CsrfTokenBadge(
            'authenticate',
            $payload->getString('_csrf_token'),
        ));

        return new Credentials(
            // Tenant names are lowercase, see TenantNaming
            mb_strtolower(trim($payload->getString('tenantName'))),
            trim($payload->getString('email')),
            $payload->getString('password'),
        );
    }
}
