<?php

namespace App\Security\Entity;

enum TokenType: string
{
    case Auth = 'auth';
    case Registration = 'registration';
    case PasswordReset = 'password_reset';
}
