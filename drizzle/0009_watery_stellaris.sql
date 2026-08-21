CREATE TABLE `telegram_broadcasts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerTelegramUserId` varchar(32) NOT NULL,
	`kind` enum('message','document') NOT NULL,
	`message` text,
	`fileId` varchar(255),
	`fileName` varchar(255),
	`caption` text,
	`status` enum('draft','sent','cancelled') NOT NULL DEFAULT 'draft',
	`recipientCount` int NOT NULL DEFAULT 0,
	`successCount` int NOT NULL DEFAULT 0,
	`failureCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `telegram_broadcasts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `telegram_subscribers` (
	`chatId` varchar(32) NOT NULL,
	`telegramUserId` varchar(32) NOT NULL,
	`subscribedAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_subscribers_chatId` PRIMARY KEY(`chatId`)
);
