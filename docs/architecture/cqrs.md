[](#cqrs-pattern-in-symfony)CQRS Pattern in Symfony
===================================================

[](#introduction)Introduction
-----------------------------

Command Query Responsibility Segregation (CQRS) is a design pattern that separates read and write operations for a data store into separate models. This approach allows each model to be optimized independently and improves the performance, scalability, and security of Symfony applications.

[](#context-and-problem)Context and Problem
-------------------------------------------

In traditional Symfony architecture, a single data model is often used for both read and write operations. This approach is straightforward and suitable for basic CRUD operations using Doctrine ORM.

As applications grow, it becomes increasingly difficult to optimize read and write operations based on a single data model. Traditional CRUD architecture doesn't account for the asymmetry of these operations, leading to the following challenges:

**Data mismatch**: Read and write representations of data often differ. Some fields required during updates may be unnecessary during read operations.

**Lock contention**: Parallel operations on the same data set can cause lock contention in Doctrine.

**Performance problems**: The traditional approach can negatively impact performance due to load on the data store and complexity of DQL/SQL queries.

**Security challenges**: It's difficult to manage security when entities are subject to both read and write operations.

[](#solution)Solution
---------------------

Use the CQRS pattern to separate write operations (commands) from read operations (queries). Commands update data. Queries retrieve data.

### [](#understanding-commands)Understanding Commands

Commands should represent specific business tasks rather than low-level data updates. For example, in a hotel booking application, use the command `BookHotelRoomCommand` instead of `SetReservationStatusCommand`.  

    // src/Application/Command/BookHotelRoomCommand.php
    namespace App\Application\Command;
    
    final readonly class BookHotelRoomCommand
    {
        public function __construct(
            public string $roomId,
            public string $guestId,
            public \DateTimeImmutable $checkIn,
            public \DateTimeImmutable $checkOut,
        ) {}
    }
    

Enter fullscreen mode Exit fullscreen mode

**Recommendations for implementing commands:**

*   **Client-side validation**: Use Symfony Forms to validate conditions before sending the command.
*   **Server-side logic**: Use Command Handlers to process business logic and edge cases.
*   **Asynchronous processing**: Process commands asynchronously using Symfony Messenger.

### [](#understanding-queries)Understanding Queries

Queries never modify data. They return DTOs (Data Transfer Objects) that present the required data in a convenient format without business logic.  

    // src/Application/Query/FindAvailableRoomsQuery.php
    namespace App\Application\Query;
    
    final readonly class FindAvailableRoomsQuery
    {
        public function __construct(
            public \DateTimeImmutable $checkIn,
            public \DateTimeImmutable $checkOut,
            public ?string $roomType = null,
        ) {}
    }
    

Enter fullscreen mode Exit fullscreen mode

[](#separating-read-and-write-models)Separating Read and Write Models
---------------------------------------------------------------------

### [](#separate-models-in-a-single-data-store)Separate Models in a Single Data Store

This is the foundational level of CQRS, where read and write models use the same database but maintain distinct logic for their operations.

**Write Model**:  

    // src/Domain/Entity/Room.php
    namespace App\Domain\Entity;
    
    use Doctrine\ORM\Mapping as ORM;
    
    #[ORM\Entity]
    class Room
    {
        #[ORM\Id]
        #[ORM\GeneratedValue]
        #[ORM\Column]
        private ?int $id = null;
    
        #[ORM\Column]
        private string $number;
    
        #[ORM\Column]
        private string $status;
    
        public function book(Guest $guest, \DateTimeImmutable $checkIn, \DateTimeImmutable $checkOut): void
        {
            if ($this->status !== 'available') {
                throw new \DomainException('Room is not available');
            }
    
            // Booking business logic
            $this->status = 'booked';
            // Create Reservation entity, etc.
        }
    }
    

Enter fullscreen mode Exit fullscreen mode

**Command Handler**:  

    // src/Application/CommandHandler/BookHotelRoomHandler.php
    namespace App\Application\CommandHandler;
    
    use App\Application\Command\BookHotelRoomCommand;
    use App\Domain\Repository\RoomRepositoryInterface;
    use Doctrine\ORM\EntityManagerInterface;
    use Symfony\Component\Messenger\Attribute\AsMessageHandler;
    
    #[AsMessageHandler]
    final readonly class BookHotelRoomHandler
    {
        public function __construct(
            private RoomRepositoryInterface $roomRepository,
            private EntityManagerInterface $entityManager,
        ) {}
    
        public function __invoke(BookHotelRoomCommand $command): void
        {
            $room = $this->roomRepository->find($command->roomId);
    
            if (!$room) {
                throw new \RuntimeException('Room not found');
            }
    
            $room->book(
                $command->guestId,
                $command->checkIn,
                $command->checkOut
            );
    
            $this->entityManager->flush();
        }
    }
    

Enter fullscreen mode Exit fullscreen mode

**Read Model**:  

    // src/Application/DTO/RoomAvailabilityDTO.php
    namespace App\Application\DTO;
    
    final readonly class RoomAvailabilityDTO
    {
        public function __construct(
            public int $id,
            public string $number,
            public string $type,
            public float $pricePerNight,
            public bool $isAvailable,
            public ?string $imageUrl = null,
        ) {}
    }
    

Enter fullscreen mode Exit fullscreen mode

**Query Handler**:  

    // src/Application/QueryHandler/FindAvailableRoomsHandler.php
    namespace App\Application\QueryHandler;
    
    use App\Application\Query\FindAvailableRoomsQuery;
    use App\Application\DTO\RoomAvailabilityDTO;
    use Doctrine\DBAL\Connection;
    use Symfony\Component\Messenger\Attribute\AsMessageHandler;
    
    #[AsMessageHandler]
    final readonly class FindAvailableRoomsHandler
    {
        public function __construct(
            private Connection $connection,
        ) {}
    
        /**
         * @return RoomAvailabilityDTO[]
         */
        public function __invoke(FindAvailableRoomsQuery $query): array
        {
            // Optimized SQL query for reading
            $sql = <<<SQL
                SELECT r.id, r.number, r.type, r.price_per_night, 
                       NOT EXISTS(
                           SELECT 1 FROM reservations res 
                           WHERE res.room_id = r.id 
                           AND res.check_out > :checkIn 
                           AND res.check_in < :checkOut
                       ) as is_available,
                       r.image_url
                FROM rooms r
                WHERE (:roomType IS NULL OR r.type = :roomType)
            SQL;
    
            $results = $this->connection->fetchAllAssociative($sql, [
                'checkIn' => $query->checkIn,
                'checkOut' => $query->checkOut,
                'roomType' => $query->roomType,
            ]);
    
            return array_map(
                fn(array $row) => new RoomAvailabilityDTO(
                    id: $row['id'],
                    number: $row['number'],
                    type: $row['type'],
                    pricePerNight: (float) $row['price_per_night'],
                    isAvailable: (bool) $row['is_available'],
                    imageUrl: $row['image_url'],
                ),
                $results
            );
        }
    }
    

Enter fullscreen mode Exit fullscreen mode

### [](#separate-models-in-different-data-stores)Separate Models in Different Data Stores

A more advanced CQRS implementation uses different data stores for read and write models.

**Doctrine configuration for multiple connections:**  

    # config/packages/doctrine.yaml
    doctrine:
        dbal:
            default_connection: write
            connections:
                write:
                    url: '%env(resolve:DATABASE_WRITE_URL)%'
                read:
                    url: '%env(resolve:DATABASE_READ_URL)%'
    
        orm:
            default_entity_manager: write
            entity_managers:
                write:
                    connection: write
                    mappings:
                        Domain:
                            type: attribute
                            dir: '%kernel.project_dir%/src/Domain/Entity'
                            prefix: 'App\Domain\Entity'
                read:
                    connection: read
                    mappings:
                        ReadModel:
                            type: attribute
                            dir: '%kernel.project_dir%/src/Infrastructure/ReadModel'
                            prefix: 'App\Infrastructure\ReadModel'
    

Enter fullscreen mode Exit fullscreen mode

**Synchronization via events:**  

    // src/Domain/Event/RoomBookedEvent.php
    namespace App\Domain\Event;
    
    final readonly class RoomBookedEvent
    {
        public function __construct(
            public string $roomId,
            public string $reservationId,
            public \DateTimeImmutable $checkIn,
            public \DateTimeImmutable $checkOut,
            public \DateTimeImmutable $occurredAt,
        ) {}
    }
    

Enter fullscreen mode Exit fullscreen mode

    // src/Infrastructure/EventListener/RoomBookedEventListener.php
    namespace App\Infrastructure\EventListener;
    
    use App\Domain\Event\RoomBookedEvent;
    use Doctrine\DBAL\Connection;
    use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
    
    #[AsEventListener]
    final readonly class RoomBookedEventListener
    {
        public function __construct(
            private Connection $readConnection,
        ) {}
    
        public function __invoke(RoomBookedEvent $event): void
        {
            // Update read model
            $this->readConnection->executeStatement(
                'UPDATE room_availability SET is_available = false WHERE room_id = :roomId',
                ['roomId' => $event->roomId]
            );
        }
    }
    

Enter fullscreen mode Exit fullscreen mode

[](#using-symfony-messenger)Using Symfony Messenger
---------------------------------------------------

Symfony Messenger is ideal for implementing CQRS:  

    # config/packages/messenger.yaml
    framework:
        messenger:
            default_bus: command.bus
            buses:
                command.bus:
                    middleware:
                        - validation
                        - doctrine_transaction
                query.bus:
                    middleware:
                        - validation
    
            transports:
                async:
                    dsn: '%env(MESSENGER_TRANSPORT_DSN)%'
                    retry_strategy:
                        max_retries: 3
                        delay: 1000
    
            routing:
                'App\Application\Command\*': async
                'App\Application\Query\*': sync
    

Enter fullscreen mode Exit fullscreen mode

[](#usage-in-controllers)Usage in Controllers
---------------------------------------------

    // src/Controller/BookingController.php
    namespace App\Controller;
    
    use App\Application\Command\BookHotelRoomCommand;
    use App\Application\Query\FindAvailableRoomsQuery;
    use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
    use Symfony\Component\HttpFoundation\JsonResponse;
    use Symfony\Component\HttpFoundation\Request;
    use Symfony\Component\Messenger\HandleTrait;
    use Symfony\Component\Messenger\MessageBusInterface;
    use Symfony\Component\Routing\Attribute\Route;
    
    class BookingController extends AbstractController
    {
        use HandleTrait;
    
        public function __construct(
            private MessageBusInterface $commandBus,
            private MessageBusInterface $queryBus,
        ) {}
    
        #[Route('/api/rooms/available', methods: ['GET'])]
        public function availableRooms(Request $request): JsonResponse
        {
            $query = new FindAvailableRoomsQuery(
                checkIn: new \DateTimeImmutable($request->query->get('check_in')),
                checkOut: new \DateTimeImmutable($request->query->get('check_out')),
                roomType: $request->query->get('room_type'),
            );
    
            $rooms = $this->handle($query);
    
            return $this->json($rooms);
        }
    
        #[Route('/api/rooms/{id}/book', methods: ['POST'])]
        public function bookRoom(string $id, Request $request): JsonResponse
        {
            $data = json_decode($request->getContent(), true);
    
            $command = new BookHotelRoomCommand(
                roomId: $id,
                guestId: $data['guest_id'],
                checkIn: new \DateTimeImmutable($data['check_in']),
                checkOut: new \DateTimeImmutable($data['check_out']),
            );
    
            $this->commandBus->dispatch($command);
    
            return $this->json(['status' => 'success'], 202);
        }
    }
    

Enter fullscreen mode Exit fullscreen mode

[](#benefits-of-cqrs-in-symfony)Benefits of CQRS in Symfony
-----------------------------------------------------------

1.  **Independent scaling**: Read and write models scale independently.
    
2.  **Optimized data schemas**: Read operations use optimized SQL queries without Doctrine ORM.
    
3.  **Security**: Separate access rights for read and write operations.
    
4.  **Separation of concerns**: Cleaner and more maintainable models.
    
5.  **Simpler queries**: Avoid complex DQL queries and Doctrine joins.
    

[](#problems-and-considerations)Problems and Considerations
-----------------------------------------------------------

**Increased complexity**: CQRS adds complexity to application architecture.

**Messaging challenges**: When using Symfony Messenger, account for failures, duplicates, and retries.

**Eventual consistency**: When data stores are separated, read data may not immediately reflect the latest changes.

[](#when-to-use-cqrs-in-symfony)When to Use CQRS in Symfony
-----------------------------------------------------------

Use this pattern when:

*   Working in multi-user environments with frequent conflicts
*   You have complex domain models with task-based interfaces
*   The write model has a full command processing stack with business logic
*   The read model has no business logic and returns DTOs
*   Independent optimization of read and write performance is required
*   The number of reads significantly exceeds the number of writes

This pattern may not be suitable when:

*   The domain or business rules are simple
*   A simple CRUD interface is sufficient
*   The application is small with low load

[](#combining-with-event-sourcing)Combining with Event Sourcing
---------------------------------------------------------------

CQRS is often combined with the Event Sourcing pattern in Symfony:  

    // src/Infrastructure/EventStore/EventStore.php
    namespace App\Infrastructure\EventStore;
    
    use App\Domain\Event\DomainEventInterface;
    
    interface EventStoreInterface
    {
        public function append(string $streamId, DomainEventInterface $event): void;
    
        /**
         * @return DomainEventInterface[]
         */
        public function read(string $streamId): array;
    }
    

Enter fullscreen mode Exit fullscreen mode

This enables:

*   Storing the history of all changes
*   Easily restoring system state
*   Creating new data views from events
*   Ensuring complete audit trails

[](#conclusion)Conclusion
-------------------------

The CQRS pattern in Symfony provides clear separation of read and write operations, improving application performance and scalability. Use Symfony Messenger to handle commands and queries, Doctrine for the write model, and optimized SQL queries for the read model. Combine with Event Sourcing for additional benefits in complex domains.
