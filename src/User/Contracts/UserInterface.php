<?php

namespace App\User\Contracts;

use App\Core\Contracts\EmailAwareInterface;
use App\Core\Contracts\UuidAwareInterface;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;

interface UserInterface extends
    PasswordAuthenticatedUserInterface,
    EmailAwareInterface,
    UuidAwareInterface
{}
