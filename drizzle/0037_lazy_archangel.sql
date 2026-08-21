ALTER TABLE `telegram_broadcasts` ADD `scheduledFor` timestamp;--> statement-breakpoint
ALTER TABLE `telegram_broadcasts` ADD `scheduleCronTaskUid` varchar(65);