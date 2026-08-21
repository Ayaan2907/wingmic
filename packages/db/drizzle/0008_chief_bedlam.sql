CREATE TABLE `interaction_attachment` (
	`id` text PRIMARY KEY NOT NULL,
	`interaction_id` text NOT NULL,
	`entity_id` text,
	`event_id` text,
	`mime_type` text DEFAULT 'image/jpeg' NOT NULL,
	`jpeg_base64` text NOT NULL,
	`byte_size` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`interaction_id`) REFERENCES `interaction`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`) REFERENCES `entity`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `attachment_interaction_idx` ON `interaction_attachment` (`interaction_id`);--> statement-breakpoint
CREATE INDEX `attachment_entity_idx` ON `interaction_attachment` (`entity_id`);