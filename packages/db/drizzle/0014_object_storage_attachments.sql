ALTER TABLE `interaction_attachment` ADD `storage_key` text;--> statement-breakpoint
ALTER TABLE `interaction_attachment` ALTER COLUMN "jpeg_base64" TO "jpeg_base64" text;
