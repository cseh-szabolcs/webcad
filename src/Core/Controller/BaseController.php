<?php

namespace App\Core\Controller;

use App\Core\App;
use App\Security\AuthProvider;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;

class BaseController extends AbstractController
{
    public static function getSubscribedServices(): array
    {
        return [
            ...parent::getSubscribedServices(),
            App::class => App::class,
            AuthProvider::class => AuthProvider::class,
            EntityManagerInterface::class => EntityManagerInterface::class,
        ];
    }

    protected function notFound(): Response
    {
        return new Response('', Response::HTTP_NOT_FOUND);
    }

    protected function emptyResponse(): Response
    {
        return new Response('', Response::HTTP_NO_CONTENT);
    }

    protected function app(): App
    {
        return $this->container->get(App::class);
    }

    protected function auth(): AuthProvider
    {
        return $this->container->get(AuthProvider::class);
    }

    protected function router(): RouterInterface
    {
        return $this->container->get('router');
    }

    protected function em(): EntityManagerInterface
    {
        return $this->container->get(EntityManagerInterface::class);
    }

    protected function saveEntity(object $entity): void
    {
        $this->em()->persist($entity);
        $this->em()->flush();
    }

    protected function removeEntity(object $entity): void
    {
        $this->em()->remove($entity);
        $this->em()->flush();
    }

    protected function isPRGResponse(): mixed
    {
        $request = $this->container->get('request_stack')->getCurrentRequest();

        return $request->getSession()->getFlashBag()->get('app_form_prg')[0] ?? null;
    }
}
