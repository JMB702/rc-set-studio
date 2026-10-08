CREATE TABLE `camera_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`shot` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `camera_positions_created_at_idx` ON `camera_positions` (`created_at`);