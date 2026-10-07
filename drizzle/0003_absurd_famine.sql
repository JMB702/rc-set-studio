ALTER TABLE `design_approvals` ADD `estimate` text;--> statement-breakpoint
ALTER TABLE `design_approvals` ADD `updated_at` integer;--> statement-breakpoint
ALTER TABLE `design_approvals` ADD `revision` integer DEFAULT 0 NOT NULL;