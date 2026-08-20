ALTER TABLE `event` ADD `external_source` text;--> statement-breakpoint
ALTER TABLE `event` ADD `external_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `event_external_idx` ON `event` (`external_source`,`external_id`);