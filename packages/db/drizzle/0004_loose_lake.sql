CREATE TABLE `act` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL CHECK (`kind` IN ('reminder', 'email', 'meeting', 'todo', 'intro')),
	`status` text DEFAULT 'drafted' NOT NULL CHECK (`status` IN ('drafted', 'snoozed', 'sent', 'dismissed')),
	`body` text NOT NULL,
	`subject` text,
	`when_hint` text,
	`run_at` integer,
	`target_entity_id` text,
	`secondary_entity_id` text,
	`source_interaction_id` text,
	`confidence` integer DEFAULT 80 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_entity_id`) REFERENCES `entity`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`secondary_entity_id`) REFERENCES `entity`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_interaction_id`) REFERENCES `interaction`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `act_user_status_idx` ON `act` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `act_user_created_idx` ON `act` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `act_target_entity_idx` ON `act` (`target_entity_id`);--> statement-breakpoint
CREATE INDEX `act_secondary_entity_idx` ON `act` (`secondary_entity_id`);--> statement-breakpoint
CREATE INDEX `act_source_interaction_idx` ON `act` (`source_interaction_id`);