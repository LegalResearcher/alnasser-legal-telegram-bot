CREATE TABLE `telegram_scheduled_tasks` (
	`taskKey` varchar(64) NOT NULL,
	`taskUid` varchar(65) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_scheduled_tasks_taskKey` PRIMARY KEY(`taskKey`)
);
--> statement-breakpoint
ALTER TABLE `telegram_important_yemeni_laws_subscription_requests` ADD `lastReminderAt` timestamp;