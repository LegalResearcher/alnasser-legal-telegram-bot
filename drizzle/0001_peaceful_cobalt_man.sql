CREATE TABLE `legal_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` enum('fiqh','civil','commercial','procedure','general') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`url` varchar(2048) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `legal_sources_id` PRIMARY KEY(`id`)
);
