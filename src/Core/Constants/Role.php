<?php

namespace App\Core\Constants;

enum Role: string
{
    case GUEST = 'ROLE_GUEST';
    case AUTH = 'ROLE_AUTH';
    case USER = 'ROLE_USER';
    case TENANT = 'ROLE_TENANT';
    case ADMIN = 'ROLE_ADMIN';
    case ROOT = 'ROLE_ROOT';
}
