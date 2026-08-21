ALTER TABLE `telegram_broadcasts` MODIFY COLUMN `status` enum('draft','sending','sent','cancelled') NOT NULL DEFAULT 'draft';
