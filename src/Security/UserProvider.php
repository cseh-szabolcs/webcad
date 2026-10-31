<?php

declare(strict_types=1);

namespace App\Security;

use App\Core\Tenancy\TenantSwitcher;
use App\User\Entity\User;
use App\User\Repository\UserRepository;
use DateTimeImmutable;
use Symfony\Component\Security\Core\Exception\UserNotFoundException;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Core\User\UserProviderInterface;
use Symfony\Component\Uid\Uuid;

readonly class UserProvider implements UserProviderInterface
{
    public const int USER_REFRESH_TIME = 60; // seconds

    public function __construct(
        private TenantSwitcher $tenantSwitcher,
        private UserRepository $userRepository,
        private AuthProvider $authProvider,
    ) {}

    public function switchTenant(string $tenantName): void
    {
        $tenant = $this->tenantSwitcher->switchTo($tenantName);
        $this->authProvider->setTenant($tenant);
    }

    public function loadUserByIdentifier(string|Uuid $identifier): UserInterface
    {
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
        if (!$user = $this->userRepository->findOneBy(['email' => $user->getUserIdentifier()])) {
            throw new UserNotFoundException();
        }

        if ($this->hasLastAccessExpired($user)) {
            $user->refreshLastAccess();
            $this->userRepository->flush();
        }

        return $user;
    }

    private function hasLastAccessExpired(User $user): bool
    {
        return $user->getLastAccess()->getTimestamp()
            < new DateTimeImmutable()->getTimestamp() - self::USER_REFRESH_TIME;
    }

    public function supportsClass(string $class): bool
    {
        return User::class === $class;
    }
}
