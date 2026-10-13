CREATE TABLE `lighting_setups` (
	`deleted_at` integer,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`rig` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lighting_setups_created_at_idx` ON `lighting_setups` (`created_at`);