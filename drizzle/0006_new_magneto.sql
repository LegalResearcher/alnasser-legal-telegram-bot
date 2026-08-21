CREATE TABLE `legislation_search_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chatId` varchar(32) NOT NULL,
	`query` varchar(255),
	`status` enum('awaiting','ready') NOT NULL DEFAULT 'awaiting',
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `legislation_search_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `legislation_search_sessions_chatId_unique` UNIQUE(`chatId`)
);
--> statement-breakpoint
ALTER TABLE `legal_folders` ADD `collection` enum('judicial','legislation') DEFAULT 'judicial' NOT NULL;--> statement-breakpoint
ALTER TABLE `legal_sources` ADD `collection` enum('judicial','legislation') DEFAULT 'judicial' NOT NULL;