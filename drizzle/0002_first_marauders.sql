CREATE TABLE `design_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`design` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `design_approvals_created_at_idx` ON `design_approvals` (`created_at`);