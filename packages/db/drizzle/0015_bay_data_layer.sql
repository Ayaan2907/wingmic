CREATE TABLE `bay_events` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_event_id` text,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`venue` text,
	`lat` real,
	`lng` real,
	`price` text,
	`category` text NOT NULL,
	`url` text NOT NULL,
	`note` text,
	`starts_at` integer,
	`ends_at` integer,
	`expires_at` integer,
	`first_seen_at` integer NOT NULL,
	`fetched_at` integer NOT NULL,
	`embedding` F32_BLOB(1536)
);
--> statement-breakpoint
CREATE INDEX `bay_events_source_idx` ON `bay_events` (`source`);--> statement-breakpoint
CREATE INDEX `bay_events_starts_at_idx` ON `bay_events` (`starts_at`);--> statement-breakpoint
CREATE INDEX `bay_events_canonical_event_idx` ON `bay_events` (`canonical_event_id`);--> statement-breakpoint
CREATE TABLE `places` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`note` text NOT NULL,
	`category` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`source` text,
	`embedding` F32_BLOB(1536),
	`fetched_at` integer NOT NULL,
	`first_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `places_slug_unique` ON `places` (`slug`);--> statement-breakpoint
CREATE INDEX `places_category_idx` ON `places` (`category`);