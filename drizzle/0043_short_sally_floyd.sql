CREATE TABLE `telegram_manual_premium_access` (
	`telegramUserId` varchar(32) NOT NULL,
	`shariaExamsAccess` boolean NOT NULL DEFAULT false,
	`secondaryExamsAccess` boolean NOT NULL DEFAULT false,
	`approvedByTelegramUserId` varchar(64) NOT NULL,
	`approvedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_manual_premium_access_telegramUserId` PRIMARY KEY(`telegramUserId`)
);
--> statement-breakpoint
ALTER TABLE `telegram_important_yemeni_laws_subscription_requests` ADD `accessScope` enum('important_laws','sharia_exams','secondary_exams') DEFAULT 'important_laws' NOT NULL;