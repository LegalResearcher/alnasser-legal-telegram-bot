CREATE TABLE `telegram_exam_forms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subjectKey` varchar(64) NOT NULL,
	`formKey` varchar(64) NOT NULL,
	`formName` varchar(255) NOT NULL,
	`sortOrder` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_exam_forms_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_exam_form_unique` UNIQUE(`subjectKey`,`formKey`)
);
