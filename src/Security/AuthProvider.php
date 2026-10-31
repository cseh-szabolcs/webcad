<?php

namespace App\Security;

use App\Core\Constants\Role;
use App\Core\Exception\NotAuthenticatedException;
use App\Core\Tenancy\Entity\Tenant;
use App\User\Entity\User;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Role\RoleHierarchyInterface;
use Symfony\Component\Security\Http\Authentication\AuthenticationUtils;

final class AuthProvider
{
    private ?Tenant $tenant = null;

    public function __construct(
        private readonly Security $security,
        public readonly AuthenticationUtils $utils,
        public readonly UserPasswordHasherInterface $passwordHasher,
        private readonly TokenStorageInterface $tokenStorage,
        private readonly RoleHierarchyInterface $roleHierarchy,
    ) {}

    public function setTenant(Tenant $tenant): void
    {
        $this->tenant = $tenant;
    }

    public function getTenant(): Tenant
    {
        if (null === $this->tenant) {
            $this->notAuthenticatedException();
        }

        return $this->tenant;
    }

    public function getUser(): User
    {
        /** @var User $user */
        if ($user = $this->tokenStorage->getToken()?->getUser()) {
            return $user;
        }

        $this->notAuthenticatedException();
    }

    public function isAuthenticated(): bool
    {
        return null !== $this->tokenStorage->getToken();
    }

    public function isGranted(mixed $attributes, mixed $subject = null): bool
    {
        return $this->security->isGranted($attributes, $subject);
    }

    public function getRole(): Role
    {
        if ($role = $this->getUser()->getRole()) {
            return $role;
        }

        return Role::GUEST;
    }

    public function getToken(): TokenInterface
    {
        return $this->tokenStorage->getToken();
    }

    public function hasRole(Role $role, ?User $user = null, bool $strict = false): bool
    {
        if ($role === Role::GUEST) {
            return !$this->isAuthenticated();
        }

        if (!$user && !$this->isAuthenticated()) {
            return false;
        }

        $user ??= $this->getUser();

        if ($strict) {
            return $user->getRole() === $role;
        }

        $roles = $this->roleHierarchy->getReachableRoleNames([$user->getRole()->value]);

        return in_array($role->value, $roles, true);
    }

    public function hashUserPassword(User $user): void
    {
        if ($password = $user->passwordPlain) {
            $user->setPassword(
                $this->passwordHasher->hashPassword($user, $password),
            );
            $user->eraseCredentials();
        }
    }

    private function notAuthenticatedException()
    {
        throw new NotAuthenticatedException('Not authenticated yet.');
    }
}
