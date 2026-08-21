CREATE TABLE `telegram_group_exam_answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roundId` int NOT NULL,
	`questionIndex` int NOT NULL,
	`telegramUserId` varchar(32) NOT NULL,
	`answer` enum('A','B','C','D') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_group_exam_answers_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_group_exam_answer_unique` UNIQUE(`roundId`,`questionIndex`,`telegramUserId`)
);
--> statement-breakpoint
CREATE TABLE `telegram_group_exam_participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roundId` int NOT NULL,
	`telegramUserId` varchar(32) NOT NULL,
	`displayName` varchar(255) NOT NULL,
	`username` varchar(64),
	`score` int NOT NULL DEFAULT 0,
	`incorrectCount` int NOT NULL DEFAULT 0,
	`missedCount` int NOT NULL DEFAULT 0,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_group_exam_participants_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_group_exam_participant_unique` UNIQUE(`roundId`,`telegramUserId`)
);
--> statement-breakpoint
CREATE TABLE `telegram_group_exam_rounds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chatId` varchar(32) NOT NULL,
	`subjectKey` varchar(64) NOT NULL,
	`sectionKey` varchar(64) NOT NULL,
	`status` enum('waiting','active','completed','cancelled') NOT NULL DEFAULT 'waiting',
	`questionIndex` int NOT NULL DEFAULT 0,
	`timeLimitSeconds` int NOT NULL DEFAULT 30,
	`activePollId` varchar(128),
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_group_exam_rounds_id` PRIMARY KEY(`id`)
);
