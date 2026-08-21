CREATE TABLE `telegram_visit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`telegramUserId` varchar(32) NOT NULL,
	`site` enum('platform','hasad') NOT NULL,
	`visitedAt` timestamp NOT NULL DEFAULT (now()),
	`region` varchar(64),
	CONSTRAINT `telegram_visit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `telegram_subscribers` ADD `telegramUsername` varchar(64);--> statement-breakpoint
ALTER TABLE `telegram_subscribers` ADD `telegramFirstName` varchar(128);--> statement-breakpoint
ALTER TABLE `telegram_subscribers` ADD `telegramLastName` varchar(128);--> statement-breakpoint
CREATE INDEX `telegram_visit_events_site_visited_at` ON `telegram_visit_events` (`site`,`visitedAt`);--> statement-breakpoint
CREATE INDEX `telegram_visit_events_user_visited_at` ON `telegram_visit_events` (`telegramUserId`,`visitedAt`);