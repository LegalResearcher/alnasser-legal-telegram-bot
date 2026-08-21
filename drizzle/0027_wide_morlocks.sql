CREATE TABLE `telegram_document_favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`telegramUserId` varchar(32) NOT NULL,
	`sourceId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `telegram_document_favorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_document_favorite_unique` UNIQUE(`telegramUserId`,`sourceId`)
);
