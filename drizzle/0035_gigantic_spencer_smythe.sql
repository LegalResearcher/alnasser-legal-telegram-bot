CREATE TABLE `telegram_managed_message_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageKey` varchar(64) NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_managed_message_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_managed_message_templates_messageKey_unique` UNIQUE(`messageKey`)
);
