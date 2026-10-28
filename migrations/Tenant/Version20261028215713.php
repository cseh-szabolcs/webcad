<?php

declare(strict_types=1);

namespace DoctrineMigrations\Tenant;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261028215713 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Plan versions: plan_version, plan.draft/head/version, contents linked to the version';
    }

    public function up(Schema $schema): void
    {
        // Existing plans are development data (app:plan:create-sample makes them again): they are
        // dropped instead of moved into versions. Their contents go with them (ON DELETE CASCADE).
        $this->addSql('DELETE FROM plan');
        $this->addSql('CREATE TABLE plan_version (number INT DEFAULT NULL, revision INT NOT NULL, created_at DATETIME NOT NULL, id BINARY(16) NOT NULL, unit VARCHAR(2) NOT NULL, plan_id BINARY(16) NOT NULL, INDEX IDX_1A39BCBE899029B (plan_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE plan_version ADD CONSTRAINT FK_1A39BCBE899029B FOREIGN KEY (plan_id) REFERENCES plan (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE element DROP FOREIGN KEY `FK_41405E39E899029B`');
        $this->addSql('DROP INDEX IDX_41405E39E899029B ON element');
        $this->addSql('DROP INDEX IDX_41405E39E899029B462CE4F5 ON element');
        $this->addSql('ALTER TABLE element CHANGE plan_id plan_version_id BINARY(16) NOT NULL');
        $this->addSql('ALTER TABLE element ADD CONSTRAINT FK_41405E3926D11D13 FOREIGN KEY (plan_version_id) REFERENCES plan_version (id) ON DELETE CASCADE');
        $this->addSql('CREATE INDEX IDX_41405E3926D11D13462CE4F5 ON element (plan_version_id, position)');
        $this->addSql('CREATE INDEX IDX_41405E3926D11D13 ON element (plan_version_id)');
        $this->addSql('ALTER TABLE element_group DROP FOREIGN KEY `FK_A9E2305CE899029B`');
        $this->addSql('DROP INDEX IDX_A9E2305CE899029B ON element_group');
        $this->addSql('ALTER TABLE element_group CHANGE plan_id plan_version_id BINARY(16) NOT NULL');
        $this->addSql('ALTER TABLE element_group ADD CONSTRAINT FK_A9E2305C26D11D13 FOREIGN KEY (plan_version_id) REFERENCES plan_version (id) ON DELETE CASCADE');
        $this->addSql('CREATE INDEX IDX_A9E2305C26D11D13 ON element_group (plan_version_id)');
        $this->addSql('ALTER TABLE element_style DROP FOREIGN KEY `FK_F79FCCF3E899029B`');
        $this->addSql('DROP INDEX IDX_F79FCCF3E899029B ON element_style');
        $this->addSql('ALTER TABLE element_style CHANGE plan_id plan_version_id BINARY(16) NOT NULL');
        $this->addSql('ALTER TABLE element_style ADD CONSTRAINT FK_F79FCCF326D11D13 FOREIGN KEY (plan_version_id) REFERENCES plan_version (id) ON DELETE CASCADE');
        $this->addSql('CREATE INDEX IDX_F79FCCF326D11D13 ON element_style (plan_version_id)');
        $this->addSql('ALTER TABLE layer DROP FOREIGN KEY `FK_E4DB211AE899029B`');
        $this->addSql('DROP INDEX IDX_E4DB211AE899029B ON layer');
        $this->addSql('DROP INDEX IDX_E4DB211AE899029B462CE4F5 ON layer');
        $this->addSql('ALTER TABLE layer CHANGE plan_id plan_version_id BINARY(16) NOT NULL');
        $this->addSql('ALTER TABLE layer ADD CONSTRAINT FK_E4DB211A26D11D13 FOREIGN KEY (plan_version_id) REFERENCES plan_version (id) ON DELETE CASCADE');
        $this->addSql('CREATE INDEX IDX_E4DB211A26D11D13462CE4F5 ON layer (plan_version_id, position)');
        $this->addSql('CREATE INDEX IDX_E4DB211A26D11D13 ON layer (plan_version_id)');
        $this->addSql('ALTER TABLE plan ADD draft_id BINARY(16) DEFAULT NULL, ADD head_id BINARY(16) DEFAULT NULL, DROP unit, CHANGE revision version INT NOT NULL');
        $this->addSql('ALTER TABLE plan ADD CONSTRAINT FK_DD5A5B7DE2F3C5D1 FOREIGN KEY (draft_id) REFERENCES plan_version (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE plan ADD CONSTRAINT FK_DD5A5B7DF41A619E FOREIGN KEY (head_id) REFERENCES plan_version (id) ON DELETE SET NULL');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_DD5A5B7DE2F3C5D1 ON plan (draft_id)');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_DD5A5B7DF41A619E ON plan (head_id)');
        $this->addSql('ALTER TABLE vertex DROP FOREIGN KEY `FK_E9F17935E899029B`');
        $this->addSql('DROP INDEX IDX_E9F17935E899029B ON vertex');
        $this->addSql('ALTER TABLE vertex CHANGE plan_id plan_version_id BINARY(16) NOT NULL');
        $this->addSql('ALTER TABLE vertex ADD CONSTRAINT FK_E9F1793526D11D13 FOREIGN KEY (plan_version_id) REFERENCES plan_version (id) ON DELETE CASCADE');
        $this->addSql('CREATE INDEX IDX_E9F1793526D11D13 ON vertex (plan_version_id)');
    }

    public function down(Schema $schema): void
    {
        // As in up(): plans are not moved back out of their versions
        $this->addSql('UPDATE plan SET draft_id = NULL, head_id = NULL');
        $this->addSql('DELETE FROM plan');
        $this->addSql('ALTER TABLE element DROP FOREIGN KEY FK_41405E3926D11D13');
        $this->addSql('DROP INDEX IDX_41405E3926D11D13462CE4F5 ON element');
        $this->addSql('DROP INDEX IDX_41405E3926D11D13 ON element');
        $this->addSql('ALTER TABLE element CHANGE plan_version_id plan_id BINARY(16) NOT NULL');
        $this->addSql('ALTER TABLE element ADD CONSTRAINT `FK_41405E39E899029B` FOREIGN KEY (plan_id) REFERENCES plan (id) ON UPDATE NO ACTION ON DELETE CASCADE');
        $this->addSql('CREATE INDEX IDX_41405E39E899029B ON element (plan_id)');
        $this->addSql('CREATE INDEX IDX_41405E39E899029B462CE4F5 ON element (plan_id, position)');
        $this->addSql('ALTER TABLE element_group DROP FOREIGN KEY FK_A9E2305C26D11D13');
        $this->addSql('DROP INDEX IDX_A9E2305C26D11D13 ON element_group');
        $this->addSql('ALTER TABLE element_group CHANGE plan_version_id plan_id BINARY(16) NOT NULL');
        $this->addSql('ALTER TABLE element_group ADD CONSTRAINT `FK_A9E2305CE899029B` FOREIGN KEY (plan_id) REFERENCES plan (id) ON UPDATE NO ACTION ON DELETE CASCADE');
        $this->addSql('CREATE INDEX IDX_A9E2305CE899029B ON element_group (plan_id)');
        $this->addSql('ALTER TABLE element_style DROP FOREIGN KEY FK_F79FCCF326D11D13');
        $this->addSql('DROP INDEX IDX_F79FCCF326D11D13 ON element_style');
        $this->addSql('ALTER TABLE element_style CHANGE plan_version_id plan_id BINARY(16) NOT NULL');
        $this->addSql('ALTER TABLE element_style ADD CONSTRAINT `FK_F79FCCF3E899029B` FOREIGN KEY (plan_id) REFERENCES plan (id) ON UPDATE NO ACTION ON DELETE CASCADE');
        $this->addSql('CREATE INDEX IDX_F79FCCF3E899029B ON element_style (plan_id)');
        $this->addSql('ALTER TABLE layer DROP FOREIGN KEY FK_E4DB211A26D11D13');
        $this->addSql('DROP INDEX IDX_E4DB211A26D11D13462CE4F5 ON layer');
        $this->addSql('DROP INDEX IDX_E4DB211A26D11D13 ON layer');
        $this->addSql('ALTER TABLE layer CHANGE plan_version_id plan_id BINARY(16) NOT NULL');
        $this->addSql('ALTER TABLE layer ADD CONSTRAINT `FK_E4DB211AE899029B` FOREIGN KEY (plan_id) REFERENCES plan (id) ON UPDATE NO ACTION ON DELETE CASCADE');
        $this->addSql('CREATE INDEX IDX_E4DB211AE899029B ON layer (plan_id)');
        $this->addSql('CREATE INDEX IDX_E4DB211AE899029B462CE4F5 ON layer (plan_id, position)');
        $this->addSql('ALTER TABLE plan DROP FOREIGN KEY FK_DD5A5B7DE2F3C5D1');
        $this->addSql('ALTER TABLE plan DROP FOREIGN KEY FK_DD5A5B7DF41A619E');
        $this->addSql('DROP INDEX UNIQ_DD5A5B7DE2F3C5D1 ON plan');
        $this->addSql('DROP INDEX UNIQ_DD5A5B7DF41A619E ON plan');
        $this->addSql('ALTER TABLE plan ADD unit VARCHAR(2) NOT NULL, DROP draft_id, DROP head_id, CHANGE version revision INT NOT NULL');
        $this->addSql('ALTER TABLE vertex DROP FOREIGN KEY FK_E9F1793526D11D13');
        $this->addSql('DROP INDEX IDX_E9F1793526D11D13 ON vertex');
        $this->addSql('ALTER TABLE vertex CHANGE plan_version_id plan_id BINARY(16) NOT NULL');
        $this->addSql('ALTER TABLE vertex ADD CONSTRAINT `FK_E9F17935E899029B` FOREIGN KEY (plan_id) REFERENCES plan (id) ON UPDATE NO ACTION ON DELETE CASCADE');
        $this->addSql('CREATE INDEX IDX_E9F17935E899029B ON vertex (plan_id)');
        // Last: plan and the contents refer to plan_version until here
        $this->addSql('ALTER TABLE plan_version DROP FOREIGN KEY FK_1A39BCBE899029B');
        $this->addSql('DROP TABLE plan_version');
    }
}
