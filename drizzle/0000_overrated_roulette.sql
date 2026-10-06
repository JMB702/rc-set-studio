CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`body` text NOT NULL,
	`element_id` text,
	`element_label` text,
	`context` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `comments_created_at_idx` ON `comments` (`created_at`);