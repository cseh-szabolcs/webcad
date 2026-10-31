<?php

namespace App\Tests\Security;

use App\Core\Constants\Role;
use App\Core\Tenancy\Repository\TenantRepository;
use App\Core\Tenancy\TenantStorage;
use App\Core\Tenancy\TenantSwitcher;
use App\User\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Component\BrowserKit\Cookie;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * Users in the default test tenant (app_demo_test), and a client logged in as one of them.
 */
trait LogsInTrait
{
    private function createUser(string $password = 'secret-password', Role $role = Role::USER): User
    {
        $container = static::getContainer();
        $container->get(TenantSwitcher::class)->switchTo($_ENV['DEFAULT_TENANT']);

        $user = new User('phpunit_'.bin2hex(random_bytes(4)).'@example.com', $role);
        $user->setPassword($container->get(UserPasswordHasherInterface::class)->hashPassword($user, $password));

        $em = $container->get(EntityManagerInterface::class);
        $em->persist($user);
        $em->flush();

        return $user;
    }

    /**
     * Like a login through the form: the security token in the session, the tenant in the cookie
     * TenantStorage reads when the session does not name one.
     */
    private function logIn(KernelBrowser $client, User $user): void
    {
        $client->loginUser($user);
        $client->getCookieJar()->set(new Cookie(TenantStorage::COOKIE, $this->defaultTenantUuid()));
    }

    /**
     * What TenantStorage stores for the default test tenant.
     */
    private function defaultTenantUuid(): string
    {
        return static::getContainer()->get(TenantRepository::class)
            ->findByName($_ENV['DEFAULT_TENANT'])->getUuid()->toRfc4122();
    }
}
