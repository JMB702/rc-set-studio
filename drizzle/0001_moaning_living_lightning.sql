CREATE TABLE `pricing_configurations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`configuration` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pricing_configurations_created_at_idx` ON `pricing_configurations` (`created_at`);