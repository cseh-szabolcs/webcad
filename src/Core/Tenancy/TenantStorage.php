<?php

namespace App\Core\Tenancy;

use App\Core\Tenancy\Entity\Tenant;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Remembers the tenant of a logged-in user between requests: in the session, and in a cookie that
 * lives as long as the remember-me cookie, so a remember-me login after the session expired finds
 * its user in the right database. Both hold the tenant's uuid, never its name, so the cookie neither
 * shows which customer (and database) it belongs to nor can be guessed. The cookie needs no
 * signature: remember-me only accepts a user whose e-mail and password hash match, which another
 * tenant's database does not have. Logging out invalidates the session and deletes the cookie
 * (logout.delete_cookies in security.yaml).
 */
final readonly class TenantStorage
{
    public const string SESSION_KEY = '_app_tenant';
    public const string COOKIE = 'tenant';

    public function __construct(
        #[Autowire(param: 'app.remember_me_lifetime')]
        private int $lifetime,
    ) {
    }

    public function store(Request $request, Response $response, Tenant $tenant): void
    {
        $uuid = $tenant->getUuid()->toRfc4122();

        $request->getSession()->set(self::SESSION_KEY, $uuid);
        $response->headers->setCookie(Cookie::create(self::COOKIE)
            ->withValue($uuid)
            ->withExpires(time() + $this->lifetime)
            ->withSecure($request->isSecure())
            ->withHttpOnly()
            ->withSameSite(Cookie::SAMESITE_LAX));
    }

    /**
     * The uuid of the stored tenant: the session's, else the cookie's, else null. Starts no session of
     * its own.
     */
    public function fromRequest(Request $request): ?string
    {
        if ($request->hasPreviousSession()) {
            $tenant = $request->getSession()->get(self::SESSION_KEY);
            if (\is_string($tenant) && '' !== $tenant) {
                return $tenant;
            }
        }

        $tenant = $request->cookies->get(self::COOKIE);

        return \is_string($tenant) && '' !== $tenant ? $tenant : null;
    }

    public function clear(Request $request): void
    {
        if ($request->hasSession()) {
            $request->getSession()->remove(self::SESSION_KEY);
        }
    }
}
