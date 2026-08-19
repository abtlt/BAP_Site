ALTER TABLE `users` ADD `xp` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `service_active` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `service_server_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `service_started_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `total_service_seconds` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `total_service_count` integer DEFAULT 0 NOT NULL;