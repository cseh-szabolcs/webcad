<?php

declare(strict_types=1);

namespace DoctrineMigrations\Tenant;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * The reverse of Version20261028223125: the display values of elements move from the JSON
 * element.props back to one column each, mapped by the element subclasses.
 */
final class Version20261029231058 extends AbstractMigration
{
    /**
     * Element type => class of its props as stored by Version20261029220621. Spelled out rather
     * than taken from the classes, which no longer exist.
     */
    private const array PROPS_CLASSES = [
        'line' => 'App\Plan\Props\LineProps',
        'polyline' => 'App\Plan\Props\PolylineProps',
        'arc' => 'App\Plan\Props\ArcProps',
        'circle' => 'App\Plan\Props\CircleProps',
        'ellipse' => 'App\Plan\Props\EllipseProps',
        'bezier' => 'App\Plan\Props\BezierProps',
    ];

    public function getDescription(): string
    {
        return 'Display values of elements as one column each instead of JSON element.props';
    }

    public function up(Schema $schema): void
    {
        // Moves the values over, so existing plans keep them. Nullable, as all types share the table.
        $this->addSql('ALTER TABLE element ADD closed TINYINT DEFAULT NULL, ADD clockwise TINYINT DEFAULT NULL, ADD radius DOUBLE PRECISION DEFAULT NULL, ADD radius_x DOUBLE PRECISION DEFAULT NULL, ADD radius_y DOUBLE PRECISION DEFAULT NULL, ADD rotation DOUBLE PRECISION DEFAULT NULL, ADD start_control_x DOUBLE PRECISION DEFAULT NULL, ADD start_control_y DOUBLE PRECISION DEFAULT NULL, ADD end_control_x DOUBLE PRECISION DEFAULT NULL, ADD end_control_y DOUBLE PRECISION DEFAULT NULL');
        $this->addSql(<<<'SQL'
            UPDATE element SET
                closed = IF(type = 'polyline', props->>'$.closed' = 'true', NULL),
                clockwise = IF(type = 'arc', props->>'$.clockwise' = 'true', NULL),
                radius = IF(type = 'circle', props->>'$.radius', NULL),
                radius_x = IF(type = 'ellipse', props->>'$.radiusX', NULL),
                radius_y = IF(type = 'ellipse', props->>'$.radiusY', NULL),
                rotation = IF(type = 'ellipse', COALESCE(props->>'$.rotation', 0), NULL),
                start_control_x = IF(type = 'bezier', props->>'$.startControl.x', NULL),
                start_control_y = IF(type = 'bezier', props->>'$.startControl.y', NULL),
                end_control_x = IF(type = 'bezier', props->>'$.endControl.x', NULL),
                end_control_y = IF(type = 'bezier', props->>'$.endControl.y', NULL)
            SQL);
        $this->addSql('ALTER TABLE element DROP props');
    }

    public function down(Schema $schema): void
    {
        // As stored by the json_document type: the class of the props under "#type", then the values
        $this->addSql('ALTER TABLE element ADD props JSON DEFAULT NULL');
        $this->addSql(<<<'SQL'
            UPDATE element SET props = CASE type
                WHEN 'line' THEN JSON_OBJECT('type', 'line')
                WHEN 'polyline' THEN JSON_OBJECT('type', 'polyline', 'closed', CAST(IF(closed, 'true', 'false') AS JSON))
                WHEN 'arc' THEN JSON_OBJECT('type', 'arc', 'clockwise', CAST(IF(clockwise, 'true', 'false') AS JSON))
                WHEN 'circle' THEN JSON_OBJECT('type', 'circle', 'radius', radius)
                WHEN 'ellipse' THEN JSON_OBJECT('type', 'ellipse', 'radiusX', radius_x, 'radiusY', radius_y, 'rotation', COALESCE(rotation, 0))
                WHEN 'bezier' THEN JSON_OBJECT(
                    'type', 'bezier',
                    'startControl', JSON_OBJECT('x', start_control_x, 'y', start_control_y),
                    'endControl', JSON_OBJECT('x', end_control_x, 'y', end_control_y)
                )
            END
            SQL);
        foreach (self::PROPS_CLASSES as $type => $class) {
            $this->addSql('UPDATE element SET props = JSON_SET(props, \'$."#type"\', ?) WHERE type = ?', [$class, $type]);
        }
        $this->addSql('ALTER TABLE element MODIFY props JSON NOT NULL, DROP closed, DROP clockwise, DROP radius, DROP radius_x, DROP radius_y, DROP rotation, DROP start_control_x, DROP start_control_y, DROP end_control_x, DROP end_control_y');
    }
}
