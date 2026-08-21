CREATE TABLE `telegram_contract_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceDocumentId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`content` json NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isPremium` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_contract_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_contract_templates_sourceDocumentId_unique` UNIQUE(`sourceDocumentId`)
);
