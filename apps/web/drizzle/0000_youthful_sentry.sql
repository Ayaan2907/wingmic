CREATE TABLE `company` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`domain` text,
	`industry` text,
	`observed_count` integer DEFAULT 1 NOT NULL,
	`promoted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `company_slug_unique` ON `company` (`slug`);--> statement-breakpoint
CREATE INDEX `company_domain_idx` ON `company` (`domain`);--> statement-breakpoint
CREATE INDEX `company_name_idx` ON `company` (`name`);--> statement-breakpoint
CREATE TABLE `connection_request` (
	`id` text PRIMARY KEY NOT NULL,
	`from_user_id` text NOT NULL,
	`to_user_id` text NOT NULL,
	`entity_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`from_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`) REFERENCES `entity`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `entity` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`kind` text DEFAULT 'person' NOT NULL,
	`name` text NOT NULL,
	`aliases` text DEFAULT '[]',
	`import_source` text,
	`embedding` F32_BLOB(1536),
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entity_owner_idx` ON `entity` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `entity_owner_name_idx` ON `entity` (`owner_user_id`,`name`);--> statement-breakpoint
CREATE TABLE `entity_company` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`company_id` text NOT NULL,
	`role` text,
	`since` integer,
	`until` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `entity`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entity_company_entity_idx` ON `entity_company` (`entity_id`);--> statement-breakpoint
CREATE INDEX `entity_company_company_idx` ON `entity_company` (`company_id`);--> statement-breakpoint
CREATE TABLE `entity_event` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`event_id` text NOT NULL,
	`role` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `entity`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entity_event_entity_idx` ON `entity_event` (`entity_id`);--> statement-breakpoint
CREATE TABLE `entity_fact` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`source_interaction_id` text,
	`confidence` integer DEFAULT 85 NOT NULL,
	`embedding` F32_BLOB(1536),
	`created_at` integer NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `entity`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_interaction_id`) REFERENCES `interaction`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `entity_fact_entity_idx` ON `entity_fact` (`entity_id`);--> statement-breakpoint
CREATE TABLE `entity_note` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `entity`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entity_note_entity_idx` ON `entity_note` (`entity_id`);--> statement-breakpoint
CREATE TABLE `entity_resolution` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`resolved_user_id` text,
	`by_claim_id` text,
	`mutual_consent_ts` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `entity`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resolved_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`by_claim_id`) REFERENCES `identity_claim`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `entity_resolution_entity_idx` ON `entity_resolution` (`entity_id`);--> statement-breakpoint
CREATE TABLE `entity_topic` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`weight` integer DEFAULT 50 NOT NULL,
	`source_interaction_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`entity_id`) REFERENCES `entity`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topic`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_interaction_id`) REFERENCES `interaction`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `entity_topic_entity_idx` ON `entity_topic` (`entity_id`);--> statement-breakpoint
CREATE TABLE `event` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`date_range_start` integer,
	`date_range_end` integer,
	`location` text,
	`url` text,
	`observed_count` integer DEFAULT 1 NOT NULL,
	`promoted_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_slug_unique` ON `event` (`slug`);--> statement-breakpoint
CREATE INDEX `event_name_idx` ON `event` (`name`);--> statement-breakpoint
CREATE TABLE `identity_claim` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`public` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `identity_claim_kind_value_idx` ON `identity_claim` (`kind`,`value`);--> statement-breakpoint
CREATE INDEX `identity_claim_user_idx` ON `identity_claim` (`user_id`);--> statement-breakpoint
CREATE TABLE `interaction` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`transcript` text NOT NULL,
	`captured_at` integer NOT NULL,
	`embedding` F32_BLOB(1536),
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `interaction_user_idx` ON `interaction` (`user_id`);--> statement-breakpoint
CREATE INDEX `interaction_captured_at_idx` ON `interaction` (`captured_at`);--> statement-breakpoint
CREATE TABLE `topic` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`aliases` text DEFAULT '[]',
	`parent_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topic_slug_unique` ON `topic` (`slug`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`name` text,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);