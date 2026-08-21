CREATE TABLE `telegram_exam_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceQuestionId` varchar(64) NOT NULL,
	`subjectKey` varchar(64) NOT NULL,
	`sectionKey` varchar(64) NOT NULL,
	`questionText` text NOT NULL,
	`optionA` text NOT NULL,
	`optionB` text NOT NULL,
	`optionC` text NOT NULL,
	`optionD` text NOT NULL,
	`correctOption` enum('A','B','C','D') NOT NULL,
	`explanation` text NOT NULL,
	`hint` text,
	`sortOrder` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_exam_questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_exam_questions_sourceQuestionId_unique` UNIQUE(`sourceQuestionId`)
);
--> statement-breakpoint
CREATE TABLE `telegram_exam_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`telegramUserId` varchar(32) NOT NULL,
	`chatId` varchar(32) NOT NULL,
	`subjectKey` varchar(64) NOT NULL,
	`sectionKey` varchar(64) NOT NULL,
	`status` enum('active','completed','cancelled') NOT NULL DEFAULT 'active',
	`questionIndex` int NOT NULL DEFAULT 0,
	`score` int NOT NULL DEFAULT 0,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_exam_sessions_id` PRIMARY KEY(`id`)
);
