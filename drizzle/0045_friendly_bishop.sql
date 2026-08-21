CREATE TABLE `telegram_managed_menu_item_premium_access` (
	`id` int AUTO_INCREMENT NOT NULL,
	`telegramUserId` varchar(32) NOT NULL,
	`menuItemId` int NOT NULL,
	`approvedByTelegramUserId` varchar(64) NOT NULL,
	`approvedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_managed_menu_item_premium_access_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_managed_menu_item_premium_access_unique` UNIQUE(`telegramUserId`,`menuItemId`)
);
--> statement-breakpoint
ALTER TABLE `telegram_important_yemeni_laws_subscription_requests` ADD `managedMenuItemId` int;--> statement-breakpoint
ALTER TABLE `telegram_managed_menu_items` ADD `accessMode` enum('free','premium') DEFAULT 'free' NOT NULL;