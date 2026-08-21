CREATE TABLE `telegram_hasad_access` (
	`telegramUserId` varchar(32) NOT NULL,
	`visitedAt` timestamp NOT NULL DEFAULT (now()),
	`region` varchar(64),
	CONSTRAINT `telegram_hasad_access_telegramUserId` PRIMARY KEY(`telegramUserId`)
);
