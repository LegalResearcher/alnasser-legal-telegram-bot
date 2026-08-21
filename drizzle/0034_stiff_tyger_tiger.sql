CREATE TABLE `telegram_managed_sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sectionKey` varchar(64) NOT NULL,
	`displayLabel` varchar(128),
	`enabled` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_managed_sections_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_managed_sections_sectionKey_unique` UNIQUE(`sectionKey`)
);
