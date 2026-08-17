CREATE TABLE `article_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article_id` text NOT NULL,
	`author_name` text NOT NULL,
	`text` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `article_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article_id` text NOT NULL,
	`filename` text NOT NULL,
	`url` text NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`uploaded_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`main_subject` text DEFAULT '' NOT NULL,
	`second_subject` text DEFAULT '' NOT NULL,
	`extra_info` text DEFAULT '' NOT NULL,
	`for_publication` integer DEFAULT true NOT NULL,
	`grade` text DEFAULT 'Journaliste' NOT NULL,
	`main_journalist_id` text,
	`second_journalist_id` text,
	`status` text DEFAULT 'disponible' NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`cancel_request_journalist_id` text,
	`cancel_request_reason` text,
	`cancel_request_date` text
);
--> statement-breakpoint
CREATE TABLE `authorized_roblox_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`roblox_id` text,
	`roblox_username` text,
	`note` text,
	`added_by` text NOT NULL,
	`added_at` text NOT NULL,
	`claimed_by_roblox_id` text
);
--> statement-breakpoint
CREATE TABLE `freeze_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`days` integer NOT NULL,
	`placed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `history_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`admin_name` text NOT NULL,
	`action` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`roblox_id` text PRIMARY KEY NOT NULL,
	`roblox_username` text NOT NULL,
	`roblox_avatar_url` text DEFAULT '' NOT NULL,
	`rp_first_name` text DEFAULT '' NOT NULL,
	`rp_last_name` text DEFAULT '' NOT NULL,
	`grade` text DEFAULT 'Journaliste stagiaire' NOT NULL,
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
