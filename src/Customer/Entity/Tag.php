<?php

namespace App\Customer\Entity;

use App\Core\Entity\BaseTag;
use App\Customer\Repository\TagRepository;
use Doctrine\ORM\Mapping as ORM;

/** A tag of customers: a tag can be assigned to many customers, a customer can have many tags. */
#[ORM\Entity(repositoryClass: TagRepository::class)]
class Tag extends BaseTag
{
}
