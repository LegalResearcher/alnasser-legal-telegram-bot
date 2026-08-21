CREATE TABLE `telegram_support_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`telegramUserId` varchar(32) NOT NULL,
	`chatId` varchar(32) NOT NULL,
	`message` text NOT NULL,
	`status` enum('new','reviewed') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `telegram_support_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `telegram_usage_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`telegramUserId` varchar(32) NOT NULL,
	`eventType` enum('browse','search','document_request','support_request') NOT NULL,
	`query` varchar(255),
	`sourceId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `telegram_usage_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `legal_sources` ADD `documentType` enum('law','regulation','decision','agreement','treaty','decree','other') DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE `legal_sources` ADD `legislationYear` int;--> statement-breakpoint
ALTER TABLE `legal_sources` ADD `issuingAuthority` varchar(255);--> statement-breakpoint
ALTER TABLE `legal_sources` ADD `isFeatured` boolean DEFAULT false NOT NULL;