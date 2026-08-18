PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`roblox_id` text PRIMARY KEY NOT NULL,
	`roblox_username` text NOT NULL,
	`roblox_avatar_url` text DEFAULT '' NOT NULL,
	`rp_first_name` text DEFAULT '' NOT NULL,
	`rp_last_name` text DEFAULT '' NOT NULL,
	`grade` text DEFAULT 'Analyste' NOT NULL,
	`role` text DEFAULT 'journaliste' NOT NULL,
	`arrival_date` text NOT NULL,
	`last_activity` text NOT NULL,
	`articles_count` integer DEFAULT 0 NOT NULL,
	`freeze_days` integer DEFAULT 0 NOT NULL,
	`deadline_date` text NOT NULL,
	`admin_freeze_active` integer DEFAULT false NOT NULL,
	`admin_freeze_reason` text,
	`admin_freeze_placed_by` text,
	`admin_freeze_placed_date` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("roblox_id", "roblox_username", "roblox_avatar_url", "rp_first_name", "rp_last_name", "grade", "role", "arrival_date", "last_activity", "articles_count", "freeze_days", "deadline_date", "admin_freeze_active", "admin_freeze_reason", "admin_freeze_placed_by", "admin_freeze_placed_date", "created_at") SELECT "roblox_id", "roblox_username", "roblox_avatar_url", "rp_first_name", "rp_last_name", "grade", "role", "arrival_date", "last_activity", "articles_count", "freeze_days", "deadline_date", "admin_freeze_active", "admin_freeze_reason", "admin_freeze_placed_by", "admin_freeze_placed_date", "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;