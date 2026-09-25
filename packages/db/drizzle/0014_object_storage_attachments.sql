DROP INDEX "account_user_idx";--> statement-breakpoint
DROP INDEX "act_user_status_idx";--> statement-breakpoint
DROP INDEX "act_user_created_idx";--> statement-breakpoint
DROP INDEX "act_target_entity_idx";--> statement-breakpoint
DROP INDEX "act_secondary_entity_idx";--> statement-breakpoint
DROP INDEX "act_source_interaction_idx";--> statement-breakpoint
DROP INDEX "api_key_hash_idx";--> statement-breakpoint
DROP INDEX "api_key_user_idx";--> statement-breakpoint
DROP INDEX "company_slug_unique";--> statement-breakpoint
DROP INDEX "company_domain_idx";--> statement-breakpoint
DROP INDEX "company_name_idx";--> statement-breakpoint
DROP INDEX "entity_owner_idx";--> statement-breakpoint
DROP INDEX "entity_owner_name_idx";--> statement-breakpoint
DROP INDEX "entity_company_entity_idx";--> statement-breakpoint
DROP INDEX "entity_company_company_idx";--> statement-breakpoint
DROP INDEX "entity_event_entity_idx";--> statement-breakpoint
DROP INDEX "entity_fact_entity_idx";--> statement-breakpoint
DROP INDEX "entity_merge_target_idx";--> statement-breakpoint
DROP INDEX "entity_merge_source_idx";--> statement-breakpoint
DROP INDEX "entity_note_entity_idx";--> statement-breakpoint
DROP INDEX "entity_resolution_entity_idx";--> statement-breakpoint
DROP INDEX "entity_topic_entity_idx";--> statement-breakpoint
DROP INDEX "event_slug_unique";--> statement-breakpoint
DROP INDEX "event_name_idx";--> statement-breakpoint
DROP INDEX "event_external_idx";--> statement-breakpoint
DROP INDEX "identity_claim_kind_value_idx";--> statement-breakpoint
DROP INDEX "identity_claim_user_idx";--> statement-breakpoint
DROP INDEX "attachment_interaction_idx";--> statement-breakpoint
DROP INDEX "attachment_entity_idx";--> statement-breakpoint
DROP INDEX "attachment_event_idx";--> statement-breakpoint
DROP INDEX "interaction_user_idx";--> statement-breakpoint
DROP INDEX "interaction_captured_at_idx";--> statement-breakpoint
DROP INDEX "interaction_user_client_capture_idx";--> statement-breakpoint
DROP INDEX "session_token_unique";--> statement-breakpoint
DROP INDEX "session_user_idx";--> statement-breakpoint
DROP INDEX "topic_slug_unique";--> statement-breakpoint
DROP INDEX "user_email_unique";--> statement-breakpoint
DROP INDEX "verification_identifier_idx";--> statement-breakpoint
ALTER TABLE `interaction_attachment` ALTER COLUMN "jpeg_base64" TO "jpeg_base64" text;--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `act_user_status_idx` ON `act` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `act_user_created_idx` ON `act` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `act_target_entity_idx` ON `act` (`target_entity_id`);--> statement-breakpoint
CREATE INDEX `act_secondary_entity_idx` ON `act` (`secondary_entity_id`);--> statement-breakpoint
CREATE INDEX `act_source_interaction_idx` ON `act` (`source_interaction_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `api_key_hash_idx` ON `api_key` (`key_hash`);--> statement-breakpoint
CREATE INDEX `api_key_user_idx` ON `api_key` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `company_slug_unique` ON `company` (`slug`);--> statement-breakpoint
CREATE INDEX `company_domain_idx` ON `company` (`domain`);--> statement-breakpoint
CREATE INDEX `company_name_idx` ON `company` (`name`);--> statement-breakpoint
CREATE INDEX `entity_owner_idx` ON `entity` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `entity_owner_name_idx` ON `entity` (`owner_user_id`,`name`);--> statement-breakpoint
CREATE INDEX `entity_company_entity_idx` ON `entity_company` (`entity_id`);--> statement-breakpoint
CREATE INDEX `entity_company_company_idx` ON `entity_company` (`company_id`);--> statement-breakpoint
CREATE INDEX `entity_event_entity_idx` ON `entity_event` (`entity_id`);--> statement-breakpoint
CREATE INDEX `entity_fact_entity_idx` ON `entity_fact` (`entity_id`);--> statement-breakpoint
CREATE INDEX `entity_merge_target_idx` ON `entity_merge` (`target_entity_id`);--> statement-breakpoint
CREATE INDEX `entity_merge_source_idx` ON `entity_merge` (`source_entity_id`);--> statement-breakpoint
CREATE INDEX `entity_note_entity_idx` ON `entity_note` (`entity_id`);--> statement-breakpoint
CREATE INDEX `entity_resolution_entity_idx` ON `entity_resolution` (`entity_id`);--> statement-breakpoint
CREATE INDEX `entity_topic_entity_idx` ON `entity_topic` (`entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `event_slug_unique` ON `event` (`slug`);--> statement-breakpoint
CREATE INDEX `event_name_idx` ON `event` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `event_external_idx` ON `event` (`external_source`,`external_id`);--> statement-breakpoint
CREATE INDEX `identity_claim_kind_value_idx` ON `identity_claim` (`kind`,`value`);--> statement-breakpoint
CREATE INDEX `identity_claim_user_idx` ON `identity_claim` (`user_id`);--> statement-breakpoint
CREATE INDEX `attachment_interaction_idx` ON `interaction_attachment` (`interaction_id`);--> statement-breakpoint
CREATE INDEX `attachment_entity_idx` ON `interaction_attachment` (`entity_id`);--> statement-breakpoint
CREATE INDEX `attachment_event_idx` ON `interaction_attachment` (`event_id`);--> statement-breakpoint
CREATE INDEX `interaction_user_idx` ON `interaction` (`user_id`);--> statement-breakpoint
CREATE INDEX `interaction_captured_at_idx` ON `interaction` (`captured_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `interaction_user_client_capture_idx` ON `interaction` (`user_id`,`client_capture_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `topic_slug_unique` ON `topic` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
ALTER TABLE `interaction_attachment` ADD `storage_key` text;