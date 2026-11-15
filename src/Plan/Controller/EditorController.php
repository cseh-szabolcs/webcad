<?php

namespace App\Plan\Controller;

use App\Core\Controller\BaseController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Requirement\Requirement;
use Symfony\Component\Uid\Uuid;

/**
 * The CAD editor for one plan: a bare page that loads the built editor from public/editor
 * (`npm run build` in depts/editor); the editor loads the plan itself through the API on
 * EDITOR_BACKEND_HOST (empty: the page's own origin).
 */
final class EditorController extends BaseController
{
    #[Route('plans/{id}/editor', name: 'plan_editor', requirements: ['id' => Requirement::UUID], methods: ['GET'])]
    public function __invoke(
        Uuid $id,
        #[Autowire(env: 'EDITOR_BACKEND_HOST')]
        string $backendHost,
    ): Response {
        return $this->render('page/plan/editor.html.twig', [
            'planId' => $id->toRfc4122(),
            'backendHost' => $backendHost,
        ]);
    }
}
