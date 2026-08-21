CREATE TABLE `legal_folders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driveFolderId` varchar(128) NOT NULL,
	`parentDriveFolderId` varchar(128),
	`name` varchar(255) NOT NULL,
	`path` text NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `legal_folders_id` PRIMARY KEY(`id`),
	CONSTRAINT `legal_folders_driveFolderId_unique` UNIQUE(`driveFolderId`)
);
--> statement-breakpoint
ALTER TABLE `legal_sources` ADD `driveFileId` varchar(128);--> statement-breakpoint
ALTER TABLE `legal_sources` ADD `driveFolderId` varchar(128);--> statement-breakpoint
ALTER TABLE `legal_sources` ADD `folderSortOrder` int DEFAULT 0 NOT NULL;