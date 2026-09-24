CREATE TABLE `api_rate_window` (
	`key_id` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`key_id`, `window_start`),
	FOREIGN KEY (`key_id`) REFERENCES `api_key`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `api_key` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`prefix` text NOT NULL,
	`key_hash` text NOT NULL,
	`scopes` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_key_hash_idx` ON `api_key` (`key_hash`);--> statement-breakpoint
CREATE INDEX `api_key_user_idx` ON `api_key` (`user_id`);