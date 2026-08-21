CREATE TABLE `telegram_admin_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminUserId` varchar(64) NOT NULL,
	`action` varchar(64) NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` varchar(64),
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `telegram_admin_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `telegram_managed_menu_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`label` varchar(128) NOT NULL,
	`actionType` enum('url','message') NOT NULL,
	`actionValue` text NOT NULL,
	`rowIndex` int NOT NULL DEFAULT 100,
	`sortOrder` int NOT NULL DEFAULT 0,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_managed_menu_items_id` PRIMARY KEY(`id`)
);
