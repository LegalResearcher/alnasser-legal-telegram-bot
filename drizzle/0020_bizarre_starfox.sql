ALTER TABLE `telegram_exam_sessions` ADD `incorrectCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `telegram_exam_sessions` ADD `missedCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `telegram_exam_sessions` ADD `timeLimitSeconds` int DEFAULT 30 NOT NULL;