<?php

namespace App\User\Contracts;

use App\Core\Contracts\EmailAwareInterface;
use App\Core\Contracts\UuidAwareInterface;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface as BaseUserInterface;

interface UserInterface extends BaseUserInterface, PasswordAuthenticatedUserInterface, EmailAwareInterface, UuidAwareInterface
{
}
