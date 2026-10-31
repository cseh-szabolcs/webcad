<?php

declare(strict_types=1);

namespace App\Security;

use App\Core\Tenancy\TenantSwitcher;
use App\User\Entity\User;
use App\User\Repository\UserRepository;
use Symfony\Component\Security\Core\Exception\UserNotFoundException;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Core\User\UserProviderInterface;
use Symfony\Component\Uid\Uuid;

/**
 * Users live in the database of their tenant. Without a selected tenant (a session or remember-me
 * cookie whose tenant is gone) there is no user to find, so the request goes on as a guest's.
 */
readonly class UserProvider implements UserProviderInterface
{
    public const int USER_REFRESH_TIME = 60; // seconds

    public function __construct(
        private UserRepository $userRepository,
        private TenantSwitcher $tenantSwitcher,
    ) {
    }

    public function loadUserByIdentifier(string|Uuid $identifier): UserInterface
    {
        $this->assertTenantSelected();

        if ($identifier instanceof Uuid) {
            return $this->userRepository->findOneBy(['uuid' => $identifier]);
        }

        if ($user = $this->userRepository->findOneBy(['email' => $identifier])) {
            return $user;
        }

        throw new UserNotFoundException();
    }

    public function refreshUser(UserInterface $user): UserInterface
    {
        $this->assertTenantSelected();

        if (!$user = $this->userRepository->findOneBy(['email' => $user->getUserIdentifier()])) {
            throw new UserNotFoundException();
        }

        if ($this->hasLastAccessExpired($user)) {
            $user->refreshLastAccess();
            $this->userRepository->flush();
        }

        return $user;
    }

    private function assertTenantSelected(): void
    {
        if (null === $this->tenantSwitcher->current()) {
            throw new UserNotFoundException('No tenant selected.');
        }
    }

    private function hasLastAccessExpired(User $user): bool
    {
        return $user->getLastAccess()->getTimestamp()
            < new \DateTimeImmutable()->getTimestamp() - self::USER_REFRESH_TIME;
    }

    public function supportsClass(string $class): bool
    {
        return User::class === $class;
    }
}
