CREATE TABLE `telegram_platform_access` (
	`telegramUserId` varchar(32) NOT NULL,
	`confirmedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `telegram_platform_access_telegramUserId` PRIMARY KEY(`telegramUserId`)
);
