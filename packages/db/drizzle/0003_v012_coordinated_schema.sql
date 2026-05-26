CREATE TABLE `entity_merge` (
	`id` text PRIMARY KEY NOT NULL,
	`source_entity_id` text NOT NULL,
	`target_entity_id` text NOT NULL,
	`merged_by_user_id` text,
	`merged_at` integer NOT NULL,
	FOREIGN KEY (`target_entity_id`) REFERENCES `entity`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`merged_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `entity_merge_target_idx` ON `entity_merge` (`target_entity_id`);--> statement-breakpoint
CREATE INDEX `entity_merge_source_idx` ON `entity_merge` (`source_entity_id`);--> statement-breakpoint
ALTER TABLE `entity` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `entity_company` ADD `source_deleted` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `entity_event` ADD `source_deleted` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `entity_topic` ADD `source_deleted` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `interaction` ADD `parent_interaction_id` text REFERENCES interaction(id);--> statement-breakpoint
ALTER TABLE `interaction` ADD `thread_root_id` text REFERENCES interaction(id);--> statement-breakpoint
ALTER TABLE `interaction` ADD `audio_storage_key` text;--> statement-breakpoint
ALTER TABLE `interaction` ADD `audio_retention_expiry` integer;--> statement-breakpoint
ALTER TABLE `interaction` ADD `client_capture_id` text;--> statement-breakpoint
ALTER TABLE `interaction` ADD `status` text DEFAULT 'committed' NOT NULL;--> statement-breakpoint
ALTER TABLE `interaction` ADD `deleted_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `interaction_user_client_capture_idx` ON `interaction` (`user_id`,`client_capture_id`);--> statement-breakpoint
ALTER TABLE `user` ADD `audio_retention_mode` text DEFAULT '24h' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `linker_model_override` text;--> statement-breakpoint
ALTER TABLE `user` ADD `preferred_mic_device_id` text;--> statement-breakpoint
ALTER TABLE `user` ADD `asr_language` text DEFAULT 'en-US' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `acknowledged_privacy` integer DEFAULT false NOT NULL;
