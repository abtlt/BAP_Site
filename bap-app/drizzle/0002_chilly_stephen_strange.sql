ALTER TABLE `articles` ADD `second_request_journalist_id` text;--> statement-breakpoint
ALTER TABLE `articles` ADD `archived` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `articles` ADD `archived_at` text;