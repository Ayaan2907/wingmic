CREATE TABLE `act` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'drafted' NOT NULL,
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
CREATE INDEX `act_user_created_idx` ON `act` (`user_id`,`created_at`);
