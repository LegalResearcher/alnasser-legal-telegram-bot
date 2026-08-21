CREATE TABLE `telegram_important_yemeni_laws_access` (
	`telegramUserId` varchar(32) NOT NULL,
	`approvedByTelegramUserId` varchar(32) NOT NULL,
	`approvedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_important_yemeni_laws_access_telegramUserId` PRIMARY KEY(`telegramUserId`)
);
--> statement-breakpoint
CREATE TABLE `telegram_important_yemeni_laws_subscription_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`telegramUserId` varchar(32) NOT NULL,
	`chatId` varchar(32) NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedByTelegramUserId` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	CONSTRAINT `telegram_important_yemeni_laws_subscription_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `legal_folders` MODIFY COLUMN `collection` enum('judicial','legislation','yemeni_laws','legal_forms','featured_references','important_yemeni_laws') NOT NULL DEFAULT 'judicial';--> statement-breakpoint
ALTER TABLE `legal_sources` MODIFY COLUMN `collection` enum('judicial','legislation','yemeni_laws','legal_forms','featured_references','important_yemeni_laws') NOT NULL DEFAULT 'judicial';