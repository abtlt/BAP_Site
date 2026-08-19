CREATE TABLE `service_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`server_id` text DEFAULT '' NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text NOT NULL,
	`duration_seconds` integer DEFAULT 0 NOT NULL
);
