<?php

namespace App\User\Controller;

use App\User\Form\RegistrationFormType;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Shows and validates the registration form. Storing the office and its user comes in a later step,
 * so a valid submission only says that registration is not available yet.
 */
final class RegistrationController extends AbstractController
{
    #[Route('/{_locale}/register', name: 'user_register', requirements: ['_locale' => '%app.locales%'], methods: ['GET', 'POST'])]
    public function __invoke(Request $request): Response
    {
        $form = $this->createForm(RegistrationFormType::class);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $this->addFlash('notice', 'user.register.not_available');

            return $this->redirectToRoute('user_register');
        }

        return $this->render('user/register.html.twig', ['form' => $form]);
    }
}
