CREATE TABLE `usage_daily` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`kind` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `day`, `kind`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
