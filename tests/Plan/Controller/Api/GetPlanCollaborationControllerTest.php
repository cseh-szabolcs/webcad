<?php

namespace App\Tests\Plan\Controller\Api;

use App\Core\Collaboration\CollaborationTokenIssuer;
use App\Core\Tenancy\TenantSwitcher;
use App\Plan\Dto\PlanDocumentDto;
use App\Plan\PlanFactory;
use App\Project\Entity\Project;
use App\Tests\Security\LogsInTrait;
use App\User\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Uid\Uuid;

final class GetPlanCollaborationControllerTest extends WebTestCase
{
    use LogsInTrait;

    private KernelBrowser $client;
    private User $user;
    private string $planId;
    private string $projectId;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $container = static::getContainer();
        $container->get(TenantSwitcher::class)->switchTo($_ENV['DEFAULT_TENANT']);
        $this->user = $this->createUser();
        $this->user->setFirstname('Erika')->setLastname('Muster');
        $this->logIn($this->client, $this->user);

        $em = $container->get(EntityManagerInterface::class);
        $project = new Project(Uuid::v7(), 'Beispielprojekt');
        $em->persist($project);
        $document = $container->get(SerializerInterface::class)->deserialize(
            file_get_contents($container->getParameter('kernel.project_dir').'/fixtures/plans/sample-plan.json'),
            PlanDocumentDto::class,
            'json',
        );
        $plan = $container->get(PlanFactory::class)->create($project, $document);
        $em->flush();
        $em->clear();

        $this->planId = $plan->getId()->toRfc4122();
        $this->projectId = $project->getId()->toRfc4122();
    }

    public function testNamespaceIsTheTenantAndRoomTheProject(): void
    {
        $this->client->request('GET', '/api/plans/'.$this->planId.'/collaboration');

        self::assertResponseIsSuccessful();
        $access = json_decode($this->client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
        self::assertSame($this->defaultTenantUuid(), $access['namespace']);
        self::assertSame($this->projectId, $access['room']);
        self::assertSame('Erika Muster', $access['userName']);
    }

    public function testTokenIsSignedForThatNamespaceAndRoom(): void
    {
        $this->client->request('GET', '/api/plans/'.$this->planId.'/collaboration');

        $access = json_decode($this->client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
        [$payload, $signature] = explode('.', $access['token']);
        $claims = json_decode(base64_decode(strtr($payload, '-_', '+/')), true, flags: \JSON_THROW_ON_ERROR);

        self::assertSame($access['namespace'], $claims['ns']);
        self::assertSame($access['room'], $claims['room']);
        self::assertSame($this->user->getUuid()->toRfc4122(), $claims['sub']);
        self::assertGreaterThan(time(), $claims['exp']);
        // Signed with the secret of the issuer, so the server that knows it accepts the token
        $expected = (new CollaborationTokenIssuer($_ENV['COLLAB_AUTH_TOKEN']))->issue($claims['ns'], $claims['room'], $claims['sub'], $claims['name'], (new \DateTimeImmutable())->setTimestamp($claims['exp'] - CollaborationTokenIssuer::LIFETIME));
        self::assertSame($expected, $access['token']);
    }

    public function testUnknownPlanReturns404(): void
    {
        $this->client->request('GET', '/api/plans/'.Uuid::v7()->toRfc4122().'/collaboration');

        self::assertResponseStatusCodeSame(404);
    }

    public function testGuestIsNotServed(): void
    {
        $this->client->getCookieJar()->clear();
        $this->client->request('GET', '/api/plans/'.$this->planId.'/collaboration');

        self::assertResponseStatusCodeSame(401);
    }
}
