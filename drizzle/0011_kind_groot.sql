ALTER TABLE `legal_folders` MODIFY COLUMN `collection` enum('judicial','legislation','yemeni_laws') NOT NULL DEFAULT 'judicial';--> statement-breakpoint
ALTER TABLE `legal_sources` MODIFY COLUMN `collection` enum('judicial','legislation','yemeni_laws') NOT NULL DEFAULT 'judicial';
--> statement-breakpoint
ALTER TABLE `legal_folders` MODIFY COLUMN `collection` enum('judicial','legislation','yemeni_laws') NOT NULL DEFAULT 'judicial';
